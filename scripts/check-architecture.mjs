import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
for (const file of await readdir("src/domain")) {
  const source = await readFile(`src/domain/${file}`, "utf8");
  assert.ok(
    !/from ['"](?:obsidian|mermaid|@modelcontextprotocol|node:)|require\(|\b(?:document|window|fetch|localStorage)\./.test(
      source,
    ),
    `${file}: domain imports a volatile adapter`,
  );
}
const css = await readFile("styles.css", "utf8");
assert.ok(
  !/(?:^|})\s*(?:html|body|#app)\b/.test(css),
  "Plugin CSS leaks into host styles",
);
const manifest = JSON.parse(await readFile("manifest.json")),
  pkg = JSON.parse(await readFile("package.json"));
assert.equal(manifest.version, pkg.version);
const caps = await import("../src/bridge-contract.js");
assert.equal(caps.BRIDGE_CAPABILITIES.version, pkg.version);
console.log(
  "PASS: domain independence, scoped plugin CSS and version agreement.",
);
