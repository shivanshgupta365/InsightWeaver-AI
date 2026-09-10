import { describe, expect, it } from "vitest";
import {
  analyzeRows,
  buildDashboard,
  normalizeRows,
  parseDate,
  parseNumber,
  profileRows,
} from "./engine";
import type { DataRow, FieldMapping } from "../types";

describe("normalization correctness", () => {
  it("parses ISO dates before locale formats and never swaps them", () => {
    expect(parseDate("2024-08-01")).toEqual({
      value: "2024-08-01",
      ambiguous: false,
    });
    expect(parseDate("08/01/2024")).toEqual({ value: null, ambiguous: true });
    expect(parseDate("08/01/2024", "DMY").value).toBe("2024-01-08");
    expect(parseDate("08/01/2024", "MDY").value).toBe("2024-08-01");
  });
  it("parses currencies, parentheses, percentages, and negatives", () => {
    expect(parseNumber("₹1,240.50")).toBe(1240.5);
    expect(parseNumber("(3,200)")).toBe(-3200);
    expect(parseNumber("-14.5%")).toBe(-14.5);
    expect(parseNumber("unknown")).toBeNull();
  });
  it("removes only exact normalized duplicates", () => {
    const rows: DataRow[] = [
      { id: "A", amount: "10" },
      { id: "A", amount: "10" },
      { id: "A", amount: "11" },
    ];
    const maps: FieldMapping[] = [
      { originalName: "id", canonicalName: "id", role: "identifier" },
      { originalName: "amount", canonicalName: "amount", role: "amount" },
    ];
    const out = normalizeRows(rows, maps);
    expect(out.exactDuplicates).toBe(1);
    expect(out.rows).toHaveLength(2);
  });
  it("keeps currencies separate when no conversion rule exists", () => {
    const rows: DataRow[] = [
      { amount: 10, currency: "USD" },
      { amount: 20, currency: "EUR" },
    ];
    const maps: FieldMapping[] = [
      { originalName: "amount", canonicalName: "amount", role: "amount" },
      { originalName: "currency", canonicalName: "currency", role: "currency" },
    ];
    const dashboard = buildDashboard(rows, maps, []);
    expect(dashboard.kpis.find((k) => k.id === "currencies")?.value).toBe(
      "USD, EUR",
    );
    expect(dashboard.kpis.some((k) => k.id === "amount")).toBe(false);
  });
  it("distinguishes financial semantic roles", () => {
    const profiles = profileRows([
      { Sales: "10", Cost: "4", Refund: "1", Balance: "50" },
    ]);
    expect(profiles.map((p) => p.inferredRole)).toEqual([
      "revenue",
      "expense",
      "refund",
      "balance",
    ]);
  });
  it("traces source-derived results and preserves original names", async () => {
    const run = await analyzeRows(
      [
        { "Order Total": "12", Date: "2026-01-01" },
        { "Order Total": "8", Date: "2026-01-02" },
      ],
      { name: "real.csv", type: "csv", size: 40 },
    );
    expect(run.manifest.fileName).toBe("real.csv");
    expect(run.profiles[0]?.originalName).toBe("Order Total");
    expect(run.normalizedRows[0]).toHaveProperty("order_total", 12);
    expect(run.trace[0]?.beforeCount).toBe(0);
    expect(run.trace[0]?.afterCount).toBe(2);
  });
});
