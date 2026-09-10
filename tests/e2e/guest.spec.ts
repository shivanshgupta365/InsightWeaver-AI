import { expect, test } from "@playwright/test";

test("recruiter journey reaches evidence and downloads actual artifacts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Turn messy data/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Open 3-minute demo/ }).click();
  await expect(
    page.getByRole("heading", { name: "The decision view" }),
  ).toBeVisible();
  await expect(page.getByText("Sales & revenue review")).toBeVisible();
  await page
    .getByRole("tablist")
    .getByRole("button", { name: "Export" })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Download complete artifact bundle/ })
    .click();
  expect((await download).suggestedFilename()).toContain(
    "sales-revenue-review",
  );
});
test("real csv upload drives mapping and row count", async ({ page }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Analyze a file" }).click();
  (await chooser).setFiles({
    name: "candidate-sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "order_id,order_date,revenue,currency\nX-731,2026-08-01,731,INR\n",
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Confirm what each field means" }),
  ).toBeVisible();
  await expect(page.getByText(/1 rows/).first()).toBeVisible();
});
test("privacy disclosure is reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy" }).click();
  await expect(
    page.getByRole("heading", { name: /Your file is not/ }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /The Gemini route rejects raw files and full row collections/,
    ),
  ).toBeVisible();
});

test("chart studio changes a demo chart from local field choices", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Open 3-minute demo/ }).click();
  await expect(page.getByLabel("Chart studio")).toBeVisible();
  await page.getByRole("combobox", { name: "Measure" }).selectOption({
    label: "refund",
  });
  await page.getByRole("button", { name: "line" }).click();
  await expect(page.getByRole("img", { name: "line chart" })).toBeVisible();
  await page.getByRole("button", { name: "donut" }).click();
  await expect(page.getByRole("img", { name: "Donut chart" })).toBeVisible();
});
