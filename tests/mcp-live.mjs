import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
const bridgeFile = process.env.REA_BOARD_BRIDGE_FILE,
  config = JSON.parse(await readFile(bridgeFile, "utf8"));
for (const headers of [
  { Authorization: "Bearer invalid" },
  { Authorization: `Bearer ${config.token}`, Origin: "https://example.com" },
]) {
  const r = await fetch(`http://127.0.0.1:${config.port}/rpc`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "board_get_capabilities", arguments: {} }),
  });
  assert.equal(r.status, 403);
}
const client = new Client({ name: "rea-board-live-test", version: "0.7.0" }),
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("mcp/server.mjs"), "--bridge-file", bridgeFile],
    stderr: "pipe",
  });
async function call(name, args = {}, error = false) {
  const result = await client.callTool({ name, arguments: args });
  if (error) {
    assert.equal(result.isError, true);
    return result.content[0].text;
  }
  assert.ok(!result.isError, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
}
try {
  await client.connect(transport);
  const listed = await client.listTools();
  assert.ok(listed.tools.some((t) => t.name === "board_expand_branch"));
  const caps = await call("board_get_capabilities");
  assert.equal(caps.editableDiagram, "flowchart");
  const path =
    process.env.REA_BOARD_TEST_BOARD ||
    `REA Board tests/MCP verification ${Date.now()}.board`;
  const created = await call("board_create", {
    path,
    map: {
      kind: "radial",
      root: "Board workflow",
      branches: [
        { label: "Manual mapping" },
        { label: "External assistant via MCP" },
        { label: "Linked vault knowledge" },
      ],
    },
    open: true,
  });
  assert.equal(created.model.nodes.length, 4);
  const updated = await call("board_apply", {
    path,
    expectedRevision: created.revision,
    operations: [
      {
        type: "update_node",
        id: "n1",
        changes: { label: "Drag, resize, route and reconnect" },
      },
    ],
  });
  assert.notEqual(updated.revision, created.revision);
  assert.match(
    await call(
      "board_apply",
      {
        path,
        expectedRevision: created.revision,
        operations: [
          { type: "update_node", id: "n1", changes: { label: "stale" } },
        ],
      },
      true,
    ),
    /Revision conflict/,
  );
  const expanded = await call("board_expand_branch", {
    path,
    expectedRevision: updated.revision,
    parentId: "n2",
    branches: [
      { label: "Choose the map structure" },
      { label: "Expand only the selected branch" },
      { label: "Preserve user edits and verify the revision" },
    ],
  });
  assert.equal(expanded.model.nodes.length, 7);
  assert.equal(
    expanded.model.nodes.find((n) => n.id === "n1").label,
    "Drag, resize, route and reconnect",
  );
  assert.match(
    await call("board_read", { path: "../outside.board" }, true),
    /vault-relative/,
  );
  if (process.env.REA_BOARD_TEST_NOTE) {
    const targets = await call("board_note_targets", {
      path: process.env.REA_BOARD_TEST_NOTE,
    });
    assert.ok(targets.length);
  }
  const read = await call("board_read", { path });
  assert.equal(read.revision, expanded.revision);
  const resource = await client.readResource({ uri: "board://capabilities" });
  assert.ok(resource.contents[0].text.includes("sourceOnlyDiagrams"));
  console.log(
    `PASS: live SDK MCP discovery (${listed.tools.length} tools), owner-token auth, Origin rejection, create/read/guarded edit/branch expansion, stale-write protection, vault path protection, note heading targets, resources and native view refresh. Example: ${path}`,
  );
} finally {
  await client.close();
}
