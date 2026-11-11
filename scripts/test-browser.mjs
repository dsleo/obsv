import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const html = readFileSync("out/index.html", "utf8");
const prefix = html.match(/src="([^"?]*)\/_next\//)?.[1] ?? "";
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, BASE_PATH: prefix, TEST_BASE_PATH: prefix } },
);
process.exit(result.status ?? 1);
