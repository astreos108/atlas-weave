import { mkdtemp, cp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const temp = await mkdtemp(join(tmpdir(), "rea-board-rebuild-"));
try {
  const builds = [];
  for (const name of ["first", "second"]) {
    const dir = join(temp, name);
    for (const file of [
      "src",
      "scripts",
      "build.mjs",
      "package.json",
      "package-lock.json",
      "styles.css",
      "manifest.json",
    ])
      await cp(file, join(dir, file), { recursive: true });
    execFileSync("npm", ["ci", "--ignore-scripts", "--no-fund", "--no-audit"], {
      cwd: dir,
      stdio: "pipe",
    });
    execFileSync(process.execPath, ["build.mjs"], { cwd: dir, stdio: "pipe" });
    builds.push(dir);
  }
  for (const file of [
    "main.js",
    "styles.css",
    "manifest.json",
    "THIRD_PARTY_NOTICES.txt",
  ])
    assert.deepEqual(
      await readFile(join(builds[0], file)),
      await readFile(join(builds[1], file)),
      `${file} differs between clean builds`,
    );
  console.log(
    "PASS: two separate clean npm-ci builds produced identical release bytes.",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
