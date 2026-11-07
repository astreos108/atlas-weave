#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BRIDGE_TOOLS, BRIDGE_CAPABILITIES } from "../src/bridge-contract.js";
const flag = process.argv.indexOf("--bridge-file"),
  bridgeFile =
    flag >= 0 ? process.argv[flag + 1] : process.env.REA_BOARD_BRIDGE_FILE;
if (!bridgeFile) {
  process.stderr.write(
    "Supply --bridge-file /path/to/vault/.obsidian/plugins/rea-whimsical/bridge.json\n",
  );
  process.exit(1);
}
const server = new Server(
  { name: "rea-board", version: "0.8.0" },
  { capabilities: { tools: {}, resources: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: BRIDGE_TOOLS.map((tool) => ({
    ...tool,
    annotations: {
      readOnlyHint: [
        "board_get_capabilities",
        "board_list",
        "board_read",
        "board_search_notes",
        "board_note_targets",
        "board_read_note",
      ].includes(tool.name),
      destructiveHint: ["board_apply", "board_replace_source"].includes(
        tool.name,
      ),
      openWorldHint: false,
    },
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    let config;
    try {
      config = JSON.parse(await readFile(bridgeFile, "utf8"));
    } catch {
      throw new Error(
        "Board bridge is unavailable. Open Obsidian and enable the external MCP bridge in REA Board settings.",
      );
    }
    if (
      !Number.isInteger(config.port) ||
      config.port < 1 ||
      config.port > 65535 ||
      typeof config.token !== "string"
    )
      throw new Error("Invalid bridge configuration");
    const response = await fetch(`http://127.0.0.1:${config.port}/rpc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: request.params.name,
        arguments: request.params.arguments || {},
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || `Bridge returned ${response.status}`);
    return { content: [{ type: "text", text: JSON.stringify(data.result) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "board://capabilities",
      name: "Board capabilities and map patterns",
      mimeType: "application/json",
    },
  ],
}));
server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri !== "board://capabilities")
    throw new Error("Unknown resource");
  return {
    contents: [
      {
        uri: req.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(BRIDGE_CAPABILITIES),
      },
    ],
  };
});
await server.connect(new StdioServerTransport());
