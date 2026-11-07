import { spawn } from "node:child_process";
const port = process.env.REA_BOARD_TEST_PORT || "5199",
  url = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let errors = "";
server.stderr.on("data", (chunk) => (errors += chunk));
const run = (file) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`tests/${file}.mjs`], {
      stdio: "inherit",
      env: { ...process.env, REA_BOARD_TEST_URL: url },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code ? reject(new Error(`${file} failed (${code})`)) : resolve(),
    );
  });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(url)).ok;
    } catch {
      /* Wait for local Vite startup. */
    }
    if (ready) break;
    if (server.exitCode !== null)
      throw new Error(errors || "Test server stopped");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Test server did not start");
  for (const file of [
    "browser",
    "positioning",
    "advanced",
    "connector-editing",
    "foundation",
    "public-release",
  ])
    await run(file);
} finally {
  server.kill();
}
