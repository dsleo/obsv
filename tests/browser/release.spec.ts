import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, readdirSync, readFileSync } from "node:fs";
const prefix = process.env.TEST_BASE_PATH ?? "";
test("the compact poll legend reveals the remaining candidates", async ({ page }) => {
  await page.goto(`${prefix}/`);
  const more = page.getByRole("button", { name: "Afficher plus de candidats" });
  await expect(more).toBeVisible();
  await more.click();
  await expect(
    page.getByRole("button", { name: "Afficher moins de candidats" }),
  ).toBeVisible();
  await expect(page.locator(".poll-event-marker").first()).toHaveAttribute(
    "href",
    /\/events\//,
  );
});
test("clicking a poll point opens its detail beside the point", async ({ page }) => {
  await page.goto(`${prefix}/`);
  const point = page.locator(".poll-observation-hit").first();
  await point.click();
  const detail = page.locator(".poll-source-card");
  await expect(detail).toBeVisible();
  await expect(detail.locator("a")).toBeVisible();
  await expect(detail).toHaveAttribute("style", /left:.*top:/);
  await expect(detail).not.toHaveAttribute("style", /right:/);
});
test("archive search survives reload and provides recovery", async ({
  page,
}) => {
  await page.goto(`${prefix}/events/`);
  await page.getByRole("button", { name: "Rechercher une actualité" }).click();
  await page.getByRole("searchbox").fill("Péchier");
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("Péchier");
  await page.getByRole("searchbox").fill("zzzz-no-matching-story");
  await expect(
    page.getByText("Aucune actualité ne correspond", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Réinitialiser la recherche" })
    .click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
});
for (const theme of ["light", "dark"] as const) {
  for (const route of [
    "/",
    "/events/",
    "/events/google-28633/",
    "/candidates/",
    "/candidates/le-pen/",
    "/method/",
    "/about/",
    "/missing-page/",
  ]) {
    test(`${theme} mobile accessibility ${route}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(prefix + route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}

test("the known source mismatches cannot reappear in published event pages", async ({
  page,
}) => {
  await page.goto(`${prefix}/events/google-28633/`);
  const sources = page.getByRole("region", { name: "Lire les sources" });
  await expect(sources).toContainText("Péchier");
  await expect(sources).not.toContainText("Loury");
  await expect(sources).not.toContainText("Bobigny");
  await page.goto(`${prefix}/events/google-26196/`);
  await expect(
    page.getByRole("region", { name: "Lire les sources" }),
  ).not.toContainText("Dijon");
  await page.goto(`${prefix}/events/`);
  await page.getByRole("button", { name: "Rechercher une actualité" }).click();
  await page.getByRole("searchbox").fill("Volkswagen");
  await expect(
    page.getByText("Aucune actualité ne correspond", { exact: false }),
  ).toBeVisible();
  // Live data decides which events carry a valid alternative: take one from the built site instead of pinning an event id.
  const withAlternative = readdirSync("out/events").find(
    (id) => existsSync(`out/events/${id}/index.html`) && readFileSync(`out/events/${id}/index.html`, "utf8").includes("SCÉNARIO ALTERNATIF"),
  );
  expect(withAlternative, "no built event page shows an alternative scenario").toBeTruthy();
  await page.goto(`${prefix}/events/${withAlternative}/`);
  await expect(page.getByText("SCÉNARIO ALTERNATIF", { exact: true })).toBeVisible();
  await expect(page.getByText("Ce qui change :", { exact: false })).toBeVisible();
});

test("every selectable chart line has meaningful light-theme contrast", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${prefix}/`);
  await page.getByRole("button", { name: "Afficher plus de candidats" }).click();
  const hiddenSeries = page.locator(".poll-series-key button[aria-pressed='false']");
  while (await hiddenSeries.count()) await hiddenSeries.first().click();
  const colors = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector(".radar-chart-panel")!)
      .backgroundColor,
    strokes: [...document.querySelectorAll('.poll-graphic svg path[stroke]')].map(
      (p) => getComputedStyle(p).stroke,
    ),
  }));
  const lum = (c: string) => {
    const rgb = c
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const bg = lum(colors.background);
  expect(colors.strokes.length).toBe(12);
  for (const color of colors.strokes) {
    const l = lum(color);
    expect(
      (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05),
    ).toBeGreaterThanOrEqual(3);
  }
});
