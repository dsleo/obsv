import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ponytail: guards one legal risk (synthetic series presented as real polls by real institutes).
// Expand the list if counsel names other terms; see docs/legal-review.md.
const REAL_POLLSTERS = /\b(Ifop|Elabe|Odoxa|OpinionWay|Harris Interactive|Toluna|Ipsos|Kantar|BVA|Verian|YouGov)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sourceFiles(file);
    return /\.(tsx?|css)$/.test(name) ? [file] : [];
  });
}

describe("visible wording", () => {
  it("never attributes synthetic series to a real polling institute", () => {
    const offenders = sourceFiles(path.join(process.cwd(), "src"))
      .filter((file) => !file.endsWith("wording.test.ts") && REAL_POLLSTERS.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
