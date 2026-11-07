import { Platform } from "obsidian";
import { createKeyedQueue } from "./workflows/save-queue.js";
import mermaid from "./mermaid-renderer.js";
import { BRIDGE_CAPABILITIES, BRIDGE_TOOLS } from "./bridge-contract.js";
import {
  safeVaultPath,
  applyOperations,
  expandedSource,
  newBoardSource,
  validateModel,
} from "./bridge-operations.js";
import { parse } from "./model.js";
import { noteTargets, isLinkableNote } from "./note-links.js";
const VIEW = "rea-whimsical";
export function createBoardService(app, plugin, hash) {
  const serializeWrite = createKeyedQueue();
  async function flush(path) {
    for (const leaf of app.workspace.getLeavesOfType(VIEW))
      if (leaf.view.file?.path === path) await leaf.view.board?.flush();
  }
  function fileAt(path, ext) {
    safeVaultPath(path, ext);
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || file.extension !== ext) throw new Error("File not found");
    return file;
  }
  async function read(path) {
    await flush(path);
    const file = fileAt(path, "board"),
      source = (await app.vault.read(file)).trim();
    return {
      path,
      source,
      revision: hash(source),
      model: parse(source),
      selection:
        app.workspace
          .getLeavesOfType(VIEW)
          .find((l) => l.view.file?.path === path)
          ?.view.board?.snapshot() || null,
    };
  }
  async function validate(source) {
    if (typeof source !== "string" || source.length > 200000 || !source.trim())
      throw new Error("Mermaid source must contain 1–200000 characters");
    await mermaid.parse(source);
    const model = parse(source);
    if (model) validateModel(model);
  }
  async function write(path, expectedRevision, make) {
    return serializeWrite(path, async () => {
      const before = await read(path);
      if (expectedRevision !== before.revision)
        throw new Error(
          "Revision conflict: read the board again before changing it",
        );
      const source = make(before.source);
      await validate(source);
      const file = fileAt(path, "board"),
        views = app.workspace
          .getLeavesOfType(VIEW)
          .filter((l) => l.view.file?.path === path);
      const save = async () => {
        await app.vault.process(file, (current) => {
          if (hash(current.trim()) !== expectedRevision)
            throw new Error(
              "Revision conflict: board changed while preparing the edit",
            );
          return source + "\n";
        });
      };
      const lock = async (index) => {
        if (index === views.length) return save();
        const board = views[index].view.board;
        if (!board?.withExternalWrite)
          throw new Error("Board session is unavailable");
        return board.withExternalWrite(before.source, () => lock(index + 1));
      };
      await lock(0);
      for (const leaf of views) await leaf.view.onLoadFile(file);
      return read(path);
    });
  }
  const handlers = {
    board_get_capabilities: async () => ({
      ...BRIDGE_CAPABILITIES,
      vault: app.vault.getName(),
    }),
    board_list: async (a) =>
      app.vault
        .getFiles()
        .filter(
          (f) =>
            f.extension === "board" &&
            f.path.toLowerCase().includes((a.query || "").toLowerCase()),
        )
        .slice(0, a.limit || 50)
        .map((f) => ({ path: f.path, title: f.basename })),
    board_read: (a) => read(a.path),
    board_create: async (a) => {
      safeVaultPath(a.path, "board");
      if (app.vault.getAbstractFileByPath(a.path))
        throw new Error("Board already exists; use a guarded edit instead");
      const source = newBoardSource(a);
      await validate(source);
      const parts = a.path.split("/");
      parts.pop();
      let parent = "";
      for (const part of parts) {
        parent += (parent ? "/" : "") + part;
        if (!app.vault.getAbstractFileByPath(parent))
          await app.vault.createFolder(parent);
      }
      const file = await app.vault.create(a.path, source + "\n");
      if (a.open !== false) await plugin.openBoard(file);
      return read(a.path);
    },
    board_apply: (a) =>
      write(a.path, a.expectedRevision, (s) =>
        applyOperations(s, a.operations),
      ),
    board_expand_branch: (a) =>
      write(a.path, a.expectedRevision, (s) => expandedSource(s, a)),
    board_replace_source: (a) =>
      write(a.path, a.expectedRevision, () => a.source),
    board_open: async (a) => {
      const file = fileAt(a.path, "board");
      await plugin.openBoard(file);
      return { path: a.path, opened: true };
    },
    board_search_notes: async (a) => {
      const query = a.query.toLowerCase();
      return app.vault
        .getMarkdownFiles()
        .filter(isLinkableNote)
        .filter((f) => {
          const aliases =
            app.metadataCache.getFileCache(f)?.frontmatter?.aliases;
          return (f.path + " " + JSON.stringify(aliases || ""))
            .toLowerCase()
            .includes(query);
        })
        .slice(0, a.limit || 30)
        .map((f) => ({ path: f.path, title: f.basename }));
    },
    board_note_targets: async (a) => noteTargets(app, fileAt(a.path, "md")),
    board_read_note: async (a) => {
      const text = await app.vault.read(fileAt(a.path, "md")),
        lines = text.split("\n"),
        start = (a.startLine || 1) - 1,
        count = a.lineCount || 200;
      return {
        path: a.path,
        startLine: start + 1,
        totalLines: lines.length,
        text: lines.slice(start, start + count).join("\n"),
      };
    },
  };
  return async function call(name, args = {}) {
    const spec = BRIDGE_TOOLS.find((t) => t.name === name);
    if (!spec) throw new Error("Unknown Board tool");
    if (!args || typeof args !== "object" || Array.isArray(args))
      throw new Error("arguments must be an object");
    for (const key of Object.keys(args))
      if (!spec.inputSchema.properties[key])
        throw new Error(`Unexpected argument: ${key}`);
    for (const key of spec.inputSchema.required)
      if (args[key] === undefined) throw new Error(`Missing argument: ${key}`);
    for (const [key, value] of Object.entries(args)) {
      const rule = spec.inputSchema.properties[key];
      if (
        (rule.type === "string" && typeof value !== "string") ||
        (rule.type === "boolean" && typeof value !== "boolean") ||
        (rule.type === "integer" && !Number.isInteger(value)) ||
        (rule.type === "array" && !Array.isArray(value)) ||
        (rule.type === "object" &&
          (!value || typeof value !== "object" || Array.isArray(value)))
      )
        throw new Error(`Invalid argument: ${key}`);
      if (
        (rule.minimum !== undefined && value < rule.minimum) ||
        (rule.maximum !== undefined && value > rule.maximum)
      )
        throw new Error(`Argument out of bounds: ${key}`);
    }
    if (
      ["board_search_notes", "board_note_targets", "board_read_note"].includes(
        name,
      ) &&
      !plugin.settings?.bridgeReadNotes
    )
      throw new Error("MCP note access is disabled in Board settings");
    return handlers[name](args);
  };
}
export async function startBridge(app, plugin) {
  if (Platform.isDesktopApp) {
    const http = require("node:http"),
      crypto = require("node:crypto"),
      fs = require("node:fs/promises"),
      path = require("node:path");
    const token = crypto.randomBytes(32).toString("hex"),
      hash = (source) =>
        crypto.createHash("sha256").update(source).digest("hex"),
      call = createBoardService(app, plugin, hash);
    const configPath = path.join(
      app.vault.adapter.getBasePath(),
      app.vault.configDir,
      "plugins",
      plugin.manifest.id,
      "bridge.json",
    );
    const server = http.createServer(async (req, res) => {
      const send = (code, value) => {
        res.writeHead(code, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(value));
      };
      const auth = Buffer.from(req.headers.authorization || ""),
        expected = Buffer.from("Bearer " + token);
      if (
        req.headers.origin ||
        auth.length !== expected.length ||
        !crypto.timingSafeEqual(auth, expected)
      ) {
        send(403, { error: "Forbidden" });
        return;
      }
      if (req.method !== "POST" || req.url !== "/rpc") {
        send(404, { error: "Not found" });
        return;
      }
      try {
        let bytes = 0,
          chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 1048576) {
            send(413, { error: "Request too large" });
            return;
          }
          chunks.push(chunk);
        }
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")),
          result = await call(parsed.name, parsed.arguments);
        send(200, { result });
      } catch (e) {
        send(400, { error: e.message });
      }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    server.unref();
    try {
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            version: 1,
            port: server.address().port,
            token,
            vault: app.vault.getName(),
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      await fs.chmod(configPath, 0o600);
    } catch (error) {
      server.close();
      throw error;
    }
    return {
      call,
      configPath,
      close() {
        server.close();
        fs.readFile(configPath, "utf8")
          .then((text) => {
            if (JSON.parse(text).token === token) return fs.unlink(configPath);
          })
          .catch(() => {});
      },
    };
  }
  throw new Error("MCP bridge requires desktop Obsidian");
}
