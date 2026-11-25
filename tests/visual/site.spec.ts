import { expect, test } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";

// Starlight renders one page per type, at `/<section>/<kind>/<slug>`.
// One page per GraphQL type kind the generator renders differently.
const pages = [
  ["object", "/types/objects/project", "Project"],
  ["enum", "/types/enums/project-status", "ProjectStatus"],
  ["interface", "/types/interfaces/node", "Node"],
  ["union", "/types/unions/search-result", "SearchResult"],
  ["input", "/types/inputs/create-project-input", "CreateProjectInput"],
  ["scalar", "/types/scalars/date-time", "DateTime"],
  ["query", "/operations/queries/projects", "projects"],
  ["mutation", "/operations/mutations/create-project", "createProject"],
  ["subscription", "/operations/subscriptions/project-changed", "projectChanged"],
  ["directive", "/types/directives/deprecated", "deprecated"],
] as const;

// Element screenshots are stitched while scrolling, so the sticky site header
// and the fixed sidebars would be painted over the content. Hide them.
const hideChrome = [
  "header, .sidebar-pane, .right-sidebar-container, .mobile-preferences { display: none !important; }",
  "footer, .kudos { display: none !important; }",
].join("\n");

test("home", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Your API, mapped with intent." }),
  ).toBeVisible();
  await argosScreenshot(page, "home");
});

for (const [kind, path, title] of pages) {
  test(`page: ${kind}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toHaveText(title);
    await argosScreenshot(page, `page-${kind}`, {
      element: page.locator("main"),
      argosCSS: hideChrome,
    });
  });
}

// Each type is also published as plain Markdown next to its page: no MDX
// or HTML spans.
test("markdown copy", async ({ page }) => {
  const response = await page.request.get("/types/objects/project.md");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body.startsWith("# ")).toBe(true);
  expect(body).not.toContain("<span");
});

// Backticked type names in deprecation reasons link to their page.
test("deprecation reason links to a type page", async ({ page }) => {
  await page.goto("/types/objects/project/");
  const link = page
    .locator("aside, blockquote, .starlight-aside", { hasText: "Replaced by" })
    .locator("a", { hasText: "ProjectStatus" })
    .first();
  await expect(link).toHaveAttribute("href", /\/types\/enums\/project-status\/?$/);
});

// A type-level `@deprecatedType` renders a "Deprecated" notice.
test("deprecated type notice links to its replacement", async ({ page }) => {
  await page.goto("/types/objects/legacy-project/");
  const notice = page
    .locator("aside, blockquote, .starlight-aside", { hasText: "Replaced by" })
    .first();
  await expect(notice).toContainText("Deprecated");
  await expect(notice.locator("a", { hasText: /^Project$/ })).toHaveAttribute(
    "href",
    /\/types\/objects\/project\/?$/,
  );
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("home", async ({ page }) => {
    await page.goto("/");
    await argosScreenshot(page, "home-dark");
  });

  test("page: object", async ({ page }) => {
    await page.goto("/types/objects/project");
    await argosScreenshot(page, "page-object-dark", {
      element: page.locator("main"),
      argosCSS: hideChrome,
    });
  });
});
