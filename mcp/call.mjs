#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bridgeFile = process.env.REA_BOARD_BRIDGE_FILE;
if (!bridgeFile) {
  process.stderr.write(
    "Set REA_BOARD_BRIDGE_FILE to the credential path shown by your vault configuration. Enable MCP in Atlas Weave first.\n",
  );
  process.exit(1);
}
const [name, raw = "{}"] = process.argv.slice(2);
if (!name) {
  process.stderr.write("Usage: node mcp/call.mjs TOOL JSON_OR_@FILE\n");
  process.exit(1);
}
const args = JSON.parse(
    raw.startsWith("@") ? await readFile(raw.slice(1), "utf8") : raw,
  ),
  client = new Client({ name: "rea-board-local-client", version: "0.9.1" }),
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(project, "mcp/server.mjs"), "--bridge-file", bridgeFile],
    stderr: "pipe",
  });
try {
  await client.connect(transport);
  const result = await client.callTool({ name, arguments: args });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.isError) process.exitCode = 1;
} finally {
  await client.close();
}
