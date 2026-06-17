import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");
const port = process.env.PORT ?? "3000";
const out = openSync(join(projectRoot, "next-dev.out.log"), "a");
const err = openSync(join(projectRoot, "next-dev.err.log"), "a");
const nextCli = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(
  process.execPath,
  [nextCli, "dev", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: projectRoot,
    detached: true,
    shell: false,
    stdio: ["ignore", out, err],
    windowsHide: true,
  },
);

child.unref();

console.log(`PID=${child.pid};PORT=${port}`);
