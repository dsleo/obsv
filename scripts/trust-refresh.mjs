// One command to re-run the whole trust check on fresh data, then append the result to docs/radar-trust-history.jsonl:
// collect polls+events, analyse new events (cache by input hash), analyse the control events, run the pair backtest
// (overall and event-specific, bias-corrected with the controls). Needs OPENAI_API_KEY, ELECTION_API_KEY and the persona index.
// Usage: npm run trust:refresh   (TRUST_DIR=<dir> to keep the runs elsewhere; --skip-collect to reuse the current data)
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";

const dir = process.env.TRUST_DIR ?? "data/generated/trust-runs";
mkdirSync(dir, { recursive: true });
const run = (cmd, args, env = {}, capture = false) => {
  const r = spawnSync(cmd, args, { stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit", env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
  return r.stdout ?? "";
};
if (!process.argv.includes("--skip-collect")) { run("npm", ["run", "data:collect"]); run("npm", ["run", "data:prepare"]); }
run("npm", ["run", "data:analyze", "--", "--out", `${dir}/events`, "--concurrency", "5"]);
run("npm", ["run", "data:analyze", "--", "--events", "scripts/fixtures/control-events.json", "--out", `${dir}/controls`, "--concurrency", "5"]);
const results = {};
for (const eventSpecific of [false, true]) {
  const out = run("node_modules/.bin/tsx", ["scripts/backtest-pairs.ts", `${dir}/events`], { BIAS_DIR: `${dir}/controls`, JSON_OUT: "1", ...(eventSpecific ? { DEMEAN_BLOC: "1" } : {}) }, true);
  const all = out.split("\n").filter((l) => l.startsWith("RESULT ")).map((l) => JSON.parse(l.slice(7))).find((r) => r.label.startsWith("ALL"));
  results[eventSpecific ? "eventSpecific" : "overall"] = all;
}
const snapshot = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const entry = { date: new Date().toISOString().slice(0, 10), polls: snapshot.polls.length, events: snapshot.events.length, ...results };
appendFileSync("docs/radar-trust-history.jsonl", `${JSON.stringify(entry)}\n`);
console.log("appended to docs/radar-trust-history.jsonl:", JSON.stringify(entry));
