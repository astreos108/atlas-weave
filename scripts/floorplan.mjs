import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revision = "94f81b463b7617e06d873ac71323ce71644c8399";
const output = path.join(root, "floorplan");
const tool = path.join(output, ".tool");
const command = process.argv[2] || "build";
if (!["build", "open"].includes(command)) {
  throw new Error("Usage: npm run floorplan -- [build|open]");
}
fs.mkdirSync(path.join(output, ".cache"), { recursive: true });
fs.writeFileSync(path.join(output, ".gitignore"), "*\n");
if (
  !fs.existsSync(path.join(tool, "REVISION")) ||
  fs.readFileSync(path.join(tool, "REVISION"), "utf8").trim() !== revision
) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-floorplan-"));
  try {
    execFileSync(
      "git",
      [
        "clone",
        "--no-checkout",
        "https://github.com/haydenschmitty/floorplan.git",
        temporary,
      ],
      { stdio: "inherit" },
    );
    execFileSync("git", ["-C", temporary, "checkout", "--detach", revision], {
      stdio: "inherit",
    });
    fs.cpSync(path.join(temporary, "skills/floorplan"), tool, {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(temporary, "LICENSE"),
      path.join(tool, "LICENSE"),
    );
    fs.writeFileSync(path.join(tool, "REVISION"), `${revision}\n`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
function run(script, ...args) {
  execFileSync(
    process.execPath,
    [path.join(tool, "scripts", script), root, ...args],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, FLOORPLAN_AGENT: "codex" },
    },
  );
}
fs.copyFileSync(
  path.join(root, "docs/floorplan/architecture.json"),
  path.join(output, "architecture.json"),
);
// Seed new descriptions, retaining local additions and upstream review markers.
const descriptionDir = path.join(output, "descriptions");
fs.mkdirSync(descriptionDir, { recursive: true });
const seed = JSON.parse(
  fs.readFileSync(path.join(root, "docs/floorplan/descriptions.json"), "utf8"),
);
const described = new Set();
for (const file of fs
  .readdirSync(descriptionDir)
  .filter((name) => name.endsWith(".json"))) {
  const destination = path.join(descriptionDir, file);
  const data = JSON.parse(fs.readFileSync(destination, "utf8"));
  for (const [name, entry] of Object.entries(data.files || {})) {
    if (!entry.description && seed.files[name])
      data.files[name] = seed.files[name];
    described.add(name);
  }
  fs.writeFileSync(destination, `${JSON.stringify(data, null, 2)}\n`);
}
const missing = Object.fromEntries(
  Object.entries(seed.files).filter(([name]) => !described.has(name)),
);
if (Object.keys(missing).length) {
  const destination = path.join(descriptionDir, "atlas-seed.json");
  const previous = fs.existsSync(destination)
    ? JSON.parse(fs.readFileSync(destination, "utf8"))
    : { files: {} };
  previous.files = { ...previous.files, ...missing };
  fs.writeFileSync(destination, `${JSON.stringify(previous, null, 2)}\n`);
}
if (fs.existsSync(path.join(output, "graph.json")))
  run("refresh.mjs", "--unattended");
else {
  run("scan.mjs");
  run("build.mjs");
}
if (command === "open") run("open.mjs", "--engine", "codex");
else
  console.log(
    "Open floorplan/index.html, or run npm run floorplan:open for the local server and optional Ask.",
  );
