import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const script = path.resolve("scripts/prepare-data.mjs");
test("a rejected feed preserves the last-good snapshot; intentional empty data still builds typed datasets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "observatoire-snapshot-"));
  try {
    await mkdir(path.join(root, "data/incoming"), { recursive: true });
    await mkdir(path.join(root, "data/generated"), { recursive: true });
    for (const name of ["events", "polls"])
      await writeFile(
        path.join(root, `data/incoming/${name}.json`),
        JSON.stringify({ schemaVersion: 1, [name]: [] }),
      );
    await writeFile(path.join(root, "data/generated/snapshot.json"), "last good");
    const bad = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, ALLOW_EMPTY_FEEDS: "false" },
      encoding: "utf8",
    });
    assert.equal(bad.status, 1);
    assert.equal(
      await readFile(path.join(root, "data/generated/snapshot.json"), "utf8"),
      "last good",
    );
    const empty = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, ALLOW_EMPTY_FEEDS: "true" },
      encoding: "utf8",
    });
    assert.equal(empty.status, 0, empty.stderr);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, "data/generated/chart.json"))).events,
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
