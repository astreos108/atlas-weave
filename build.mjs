import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { writeNotices } from "./scripts/license-notices.mjs";
const result = await build({
  entryPoints: ["src/plugin.js"],
  bundle: true,
  external: ["obsidian", "electron", "node:*"],
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: "main.js",
  minify: true,
  legalComments: "eof",
  metafile: true,
  logLevel: "info",
});
await writeNotices(Object.keys(result.metafile.inputs));
await mkdir("dist", { recursive: true });
for (const file of [
  "main.js",
  "styles.css",
  "manifest.json",
  "THIRD_PARTY_NOTICES.txt",
])
  await copyFile(file, `dist/${file}`);
await writeFile(
  "dist/build-inputs.json",
  JSON.stringify(result.metafile, null, 2) + "\n",
);
