import { expect, test } from "@playwright/test";

test("workflow navigation keeps the shell stable", async ({ page }) => {
  const shellNav = page.getByRole("navigation", { name: "Workflow navigation" });
  const shellSearch = page.getByLabel("Search loads and drivers");
  const goLiveButton = page.getByRole("button", { name: "Go Live" });

  await page.goto("/load-assignment");

  await expect(page.getByRole("heading", { name: "Load Assignment" })).toBeVisible();
  await expect(shellNav.getByRole("link", { name: "Load Assignment" })).toHaveAttribute("aria-current", "page");
  await expect(shellSearch).toBeVisible();
  await expect(goLiveButton).toBeVisible();

  await page.getByRole("button", { name: /assign omar ruiz/i }).click();

  await expect(page.getByRole("status")).toContainText("Assigned Omar Ruiz to ATL-MCO-3382");

  await shellNav.getByRole("link", { name: "Backhaul Pairing" }).click();

  await expect(page.getByRole("heading", { name: "AI Backhaul Optimizer" })).toBeVisible();
  await expect(shellNav.getByRole("link", { name: "Backhaul Pairing" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Omar Ruiz")).toBeVisible();
  await expect(page.getByText("ATL-MCO-3382")).toBeVisible();
  await expect(shellSearch).toBeVisible();
  await expect(goLiveButton).toBeVisible();

  await page
    .locator("section")
    .filter({ hasText: "Activation status" })
    .getByRole("button", { name: /activate marketplace/i })
    .click();

  await expect(page.getByRole("status")).toContainText("Marketplace activated");
  await expect(page.getByRole("status")).toContainText("St. Louis, MO -> Indianapolis, IN");

  await shellNav.getByRole("link", { name: "Proactive Monitoring" }).click();

  await expect(page.getByRole("heading", { name: "Urgent Action Required" })).toBeVisible();
  await expect(shellNav.getByRole("link", { name: "Proactive Monitoring" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("St. Louis, MO -> Indianapolis, IN").first()).toBeVisible();
  await expect(shellSearch).toBeVisible();
  await expect(goLiveButton).toBeVisible();

  await shellNav.getByRole("link", { name: "Morning Triage" }).click();

  await expect(page.getByRole("heading", { name: "Morning Triage" })).toBeVisible();
  await expect(shellNav.getByRole("link", { name: "Morning Triage" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("ATL-MCO-3382")).toBeVisible();
  await expect(shellSearch).toBeVisible();
  await expect(goLiveButton).toBeVisible();
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("workflow navigation remains usable on mobile", async ({ page }) => {
    await page.goto("/morning-triage");

    const shellNav = page.getByRole("navigation", { name: "Workflow navigation" });

    await expect(shellNav).toBeVisible();
    await expect(shellNav.getByRole("link", { name: "Load Assignment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dispatch New Load" })).toBeVisible();

    await shellNav.getByRole("link", { name: "Proactive Monitoring" }).click();

    await expect(page.getByRole("heading", { name: "Urgent Action Required" })).toBeVisible();
    await expect(shellNav.getByRole("link", { name: "Proactive Monitoring" })).toHaveAttribute("aria-current", "page");
  });
});
