import { test, expect } from "@playwright/test";
import { require as tsxRequire } from "tsx/cjs/api";

// Use the application's TS/JSON loader for server-side publication data.
const { pollCandidates, windowEvents } = tsxRequire("../../src/data/chartData.ts", import.meta.url) as typeof import("../../src/data/chartData");
const { topSolde } = tsxRequire("../../src/lib/radar/highlights.ts", import.meta.url) as typeof import("../../src/lib/radar/highlights");
const { impactCells } = tsxRequire("../../src/lib/radar/impactMap.ts", import.meta.url) as typeof import("../../src/lib/radar/impactMap");
const { loadAnalysis } = tsxRequire("../../src/lib/radar/loadAnalysis.ts", import.meta.url) as typeof import("../../src/lib/radar/loadAnalysis");
const { publishedEvents } = tsxRequire("../../src/lib/radar/publishedEvents.ts", import.meta.url) as typeof import("../../src/lib/radar/publishedEvents");
const { L1_ORDER } = tsxRequire("../../src/lib/radar/groupFamilies.ts", import.meta.url) as typeof import("../../src/lib/radar/groupFamilies");

const prefix = process.env.TEST_BASE_PATH ?? "";
const events = publishedEvents.flatMap((event) => {
  const analysis = loadAnalysis(event.id);
  const hero = topSolde(analysis, ["abstention"]);
  const meta = windowEvents.find((item) => item.id === event.id);
  return hero && meta ? [{ ...meta, hero, cells: impactCells(analysis) }] : [];
}).sort((a, b) => a.pollDay - b.pollDay || a.id.localeCompare(b.id));

test("homepage selects individual events and keeps the comparison synchronized", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`${prefix}/`);
  const slider = page.getByRole("slider", { name: "Événement affiché" });
  await expect(slider).toHaveValue(String(events.length - 1));
  await expect(page.locator(".impact-map")).toBeVisible();
  await expect(page.getByText("Compare all subpopulations")).toHaveCount(0);
  await expect(page.locator(".impact-event-slider")).not.toContainText(/Événement|Grève/);
  await expect(page.locator("#impact-event-title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Rejouer|Pause/ })).toHaveCount(0);
  // The control belongs directly below the retained main visualization.
  await expect(page.locator(".impact-hero + .impact-event-slider input")).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  const initialBox = (await page.locator(".impact-hero").boundingBox())!;
  const initialMatrix = (await page.locator(".impact-map table").boundingBox())!;
  await slider.focus();
  await slider.press("Home");
  const columnPairOrders = new Map<string, number>();
  // Check every event, including distinct events on the same date/week, against
  // its published analysis. No preceding event may contribute a matrix value.
  for (const [index, event] of events.entries()) {
    if (index) await slider.press("ArrowRight");
    await expect(slider).toHaveValue(String(index));
    const headers = await page.locator(".impact-map thead th").allTextContents();
    const candidates = [...new Set(event.cells.map((cell) => cell.c))];
    const labels = candidates.map((id) => id === "abstention" ? "Abstention" : pollCandidates.find((candidate) => candidate.id === id)?.short ?? id);
    expect(headers.slice(1).sort()).toEqual(labels.sort());
    const numberedLabels = ["Abstention", "Le Pen", "Mélenchon", "Philippe", "Attal", "Glucksmann", "Tondelier", "Roussel", "Retailleau", "Lisnard", "Zemmour", "Dupont-Aignan", "Arthaud", "bardella"];
    const columnNumbers = headers.slice(1).map((label) => numberedLabels.indexOf(label));
    expect(columnNumbers.every((number) => number >= 0)).toBe(true);
    expect(columnNumbers).toEqual([...columnNumbers].sort((a, b) => a - b));
    // Every co-occurring pair must keep the same order across different events.
    for (const a of labels) {
      for (const b of labels.filter((label) => label > a)) {
        const key = `${a}|${b}`;
        const order = Math.sign(headers.indexOf(a) - headers.indexOf(b));
        expect(order).toBe(columnPairOrders.get(key) ?? order);
        columnPairOrders.set(key, order);
      }
    }
    if (headers.includes("Mélenchon") && headers.includes("Le Pen")) {
      expect(headers.indexOf("Le Pen")).toBeLessThan(headers.indexOf("Mélenchon"));
    }
    expect(new Set(headers).size).toBe(headers.length);
    await expect(page.locator(".impact-hero-event-title > a")).toHaveAttribute("href", `${prefix}/events/${event.id}`);
    await expect(page.locator(".impact-hero-event-title > a")).toHaveText(event.title);
    await expect(page.locator(".impact-hero-copy .impact-hero-who")).toHaveText(event.hero.segmentName);
    const heroBox = (await page.locator(".impact-hero").boundingBox())!;
    expect(heroBox.height).toBeCloseTo(initialBox.height, 1);
    expect(heroBox.width).toBeCloseTo(initialBox.width, 1);
    await expect(page.locator(".impact-map tbody th button")).toHaveText([...L1_ORDER]);
    const matrix = (await page.locator(".impact-map table").boundingBox())!;
    expect(matrix.height).toBeCloseTo(initialMatrix.height, 1);
    const emptyRows = page.locator(".impact-row-empty");
    for (const row of await emptyRows.all()) {
      await expect(row.getByRole("button")).toBeDisabled();
      await expect(row.locator("td a")).toHaveCount(0);
      await expect(row.locator("td:not(.impact-cell-empty)")).toHaveCount(0);
    }
    const nameFits = await page.locator(".impact-hero-copy .impact-hero-who").evaluate((name) => {
      const hero = name.closest(".impact-hero")!.getBoundingClientRect();
      const text = name.getBoundingClientRect();
      return text.left >= hero.left && text.right <= hero.right && text.bottom <= hero.bottom;
    });
    expect(nameFits).toBe(true);
    const share = event.hero.net / event.hero.sampled;
    expect(Math.abs(share)).toBeGreaterThanOrEqual(0.05);
    await expect(page.locator(".impact-hero-value")).toHaveText(`${share > 0 ? "+" : "−"}${Math.round(Math.abs(share) * 100)} %`);
    const targets = await page.locator(".impact-map td a").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
    expect(targets).toEqual(event.cells.length ? [`${prefix}/events/${event.id}`] : []);
    const values = await page.locator(".impact-map tbody tr").evaluateAll((rows) => rows.flatMap((row) => {
      const family = row.querySelector("th")?.textContent;
      const columns = Array.from(row.closest("table")!.querySelectorAll("thead th"));
      return Array.from(row.querySelectorAll("td")).flatMap((cell, i) => cell.textContent ? [{ family, candidate: columns[i + 1].textContent, value: cell.textContent }] : []);
    }));
    // Family cells represent the strongest subgroup in this event alone.
    for (const value of values) {
      const candidate = value.candidate === "Abstention" ? "abstention" : pollCandidates.find((c) => c.short === value.candidate)?.id;
      const strongest = event.cells.filter((c) => c.f1 === value.family && c.c === candidate).sort((a, b) => Math.abs(b.s) - Math.abs(a.s))[0];
      expect(strongest).toBeTruthy();
      expect(Math.abs(strongest.s)).toBeGreaterThanOrEqual(0.05);
      expect(value.value).toBe(`${strongest.s > 0 ? "+" : "−"}${Math.round(Math.abs(strongest.s) * 100)} %`);
    }
  }
  // A selected event stays selected while idle.
  await page.waitForTimeout(1500);
  await expect(slider).toHaveValue(String(events.length - 1));
  await expect(page.locator(".impact-map")).toBeVisible();
  await expect(page.getByRole("link", { name: "Suivre la campagne" })).toBeVisible();
});

test("the event slider supports pointer dragging and subgroup expansion", async ({ page }) => {
  await page.goto(`${prefix}/`);
  const slider = page.getByRole("slider", { name: "Événement affiché" });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(slider).toHaveValue("0");
  await expect(page.locator(".impact-hero-event-title > a")).toContainText(events[0].title);
  await expect(page.locator(".impact-map")).toBeVisible();
  const family = page.locator(".impact-map th button:enabled").first();
  await family.click();
  await expect(family).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".impact-sub").first()).toBeVisible();
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(page.locator(".impact-sub")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
