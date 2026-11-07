import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
export async function writeNotices(inputs) {
  const packages = new Map();
  for (const input of inputs) {
    if (!input.includes("node_modules/")) continue;
    let dir = dirname(input);
    while (dir !== "." && dir !== "node_modules") {
      try {
        const pkg = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        );
        if (pkg.name && pkg.version) {
          packages.set(`${pkg.name}@${pkg.version}`, { dir, pkg });
          break;
        }
      } catch {
        /* Ascend to the owning package. */
      }
      dir = dirname(dir);
    }
  }
  let text =
    "Third-party licenses for code bundled in main.js\nGenerated from esbuild inputs; do not remove license notices.\n";
  for (const [id, { dir, pkg }] of [...packages].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    text += `\n${"=".repeat(72)}\n${id}\nLicense: ${pkg.license || "See included notice"}\n`;
    const files = (await readdir(dir))
      .filter((f) => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(f))
      .sort();
    for (const file of files) {
      try {
        text += `\n${file}\n${await readFile(join(dir, file), "utf8")}\n`;
      } catch {
        /* Package directories named LICENSE are not license documents. */
      }
    }
    if (!files.length)
      throw new Error(`Missing license notice for bundled dependency ${id}`);
  }
  await writeFile("THIRD_PARTY_NOTICES.txt", text);
}
