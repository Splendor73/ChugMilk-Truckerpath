import { expect, test } from "@playwright/test";

test("loads the Co-Dispatch shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /co-dispatch/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /morning triage/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /dispatch new load/i })).toBeVisible();
});
