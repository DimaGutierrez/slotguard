import { test, expect } from "@playwright/test";

test("booking, conflict alternatives, cancellation and a real race", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "A space for every plan." }),
  ).toBeVisible();
  // Use different dates across projects; run against a dedicated synthetic instance.
  const date = new Date();
  date.setUTCDate(
    date.getUTCDate() + (testInfo.project.name === "mobile" ? 6 : 5),
  );
  await page
    .getByLabel("Agenda date", { exact: true })
    .fill(date.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await page
    .getByLabel("Meeting title", { exact: true })
    .fill("E2E design review");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "E2E design review", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await page
    .getByLabel("Meeting title", { exact: true })
    .fill("Competing meeting");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Someone booked this room first",
  );
  await expect(
    page.getByRole("button", { name: "Orbit at 10:00", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Orbit at 10:00", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Competing meeting", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("article")
    .filter({ hasText: "Competing meeting" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Competing meeting", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("article")
    .filter({ hasText: "E2E design review" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "E2E design review", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Concurrency lab/ }).click();
  await page
    .getByRole("button", { name: "Run the challenge", exact: true })
    .click();
  await expect(
    page.getByText("One confirmed booking. Verified in the database.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/HTTP 201/)).toBeVisible();
  await expect(page.getByText(/HTTP 409/)).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome in." }),
  ).toBeVisible();
});
