import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import type {
  AnalysisRun,
  CellValue,
  ColumnProfile,
  DashboardSpec,
  DataRow,
  FieldMapping,
  SemanticRole,
  TransformationEvent,
  ValidationResult,
  WorkflowRecipe,
} from "../types";
import { SCHEMA_VERSION } from "../types";

export const LIMITS = { bytes: 25 * 1024 * 1024, rows: 100_000, columns: 200 };
const missing = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === "";
const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "column";
const dateWords = /date|time|month|period|created|updated|closed|due/i;
const currencyWords = /currency|ccy/i;
const rolePatterns: [SemanticRole, RegExp][] = [
  [
    "identifier",
    /(^id$|_id$|order_id|invoice_id|ticket_id|reference|customer_id)/i,
  ],
  ["date", dateWords],
  ["revenue", /revenue|sales|income|gmv/i],
  ["expense", /expense|cost|spend|burn/i],
  ["refund", /refund|return_amount/i],
  ["balance", /balance|cash|runway/i],
  ["currency", currencyWords],
  ["status", /status|state|outcome/i],
  ["category", /category|segment|region|channel|owner|department|type/i],
  ["amount", /amount|value|price|total/i],
];

export function inferRole(name: string, values: CellValue[]): SemanticRole {
  for (const [role, re] of rolePatterns) if (re.test(name)) return role;
  const present = values.filter((v) => !missing(v));
  if (
    present.length &&
    present.every(
      (v) => typeof v === "boolean" || /^(true|false|yes|no)$/i.test(String(v)),
    )
  )
    return "boolean";
  if (
    present.length &&
    present.filter((v) => parseNumber(v) !== null).length / present.length >
      0.85
  )
    return "number";
  return "text";
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (missing(value)) return null;
  const raw = String(value).trim();
  const paren = /^\(.*\)$/.test(raw);
  const cleaned = raw
    .replace(/[₹$€£¥,%\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/,/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? (paren ? -n : n) : null;
}

export function parseDate(
  value: unknown,
  locale?: "DMY" | "MDY" | "ISO",
): { value: string | null; ambiguous: boolean } {
  if (missing(value)) return { value: null, ambiguous: false };
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return { value: value.toISOString().slice(0, 10), ambiguous: false };
  const raw = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? { value: null, ambiguous: false }
      : { value: d.toISOString().slice(0, 10), ambiguous: false };
  }
  const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (!parts) return { value: null, ambiguous: false };
  const a = Number(parts[1]),
    b = Number(parts[2]);
  const ambiguous = a <= 12 && b <= 12 && !locale;
  if (ambiguous) return { value: null, ambiguous: true };
  const month = locale === "MDY" ? a : b;
  const day = locale === "MDY" ? b : a;
  const d = new Date(Date.UTC(Number(parts[3]), month - 1, day));
  return Number.isNaN(d.getTime()) || d.getUTCDate() !== day
    ? { value: null, ambiguous: false }
    : { value: d.toISOString().slice(0, 10), ambiguous: false };
}

function dedupeHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const base = String(h || `column_${i + 1}`).trim();
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}
function rowsFromMatrix(matrix: unknown[][]): DataRow[] {
  const headers = dedupeHeaders((matrix[0] ?? []).map(String));
  return matrix
    .slice(1)
    .filter((r) => r.some((v) => !missing(v)))
    .map((r) =>
      Object.fromEntries(
        headers.map((h, i) => [h, (r[i] ?? null) as CellValue]),
      ),
    );
}

export async function parseFile(file: File): Promise<DataRow[]> {
  if (file.size > LIMITS.bytes)
    throw new Error("File exceeds the 25 MB browser limit.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rows: DataRow[];
  if (ext === "csv")
    rows = Papa.parse<DataRow>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h, i) => h.trim() || `column_${i + 1}`,
    }).data;
  else if (ext === "json") {
    const parsed: unknown = JSON.parse(await file.text());
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (x) => typeof x !== "object" || x === null || Array.isArray(x),
      )
    )
      throw new Error("JSON must be an array of objects.");
    rows = parsed as DataRow[];
  } else if (ext === "xlsx")
    rows = rowsFromMatrix((await readXlsxFile(file)) as unknown[][]);
  else
    throw new Error(
      "Use a CSV, XLSX, or JSON file. Legacy .xls files are not supported.",
    );
  const columns = [...new Set(rows.flatMap(Object.keys))];
  if (!rows.length) throw new Error("The file has no data rows.");
  if (rows.length > LIMITS.rows)
    throw new Error("Dataset exceeds the 100,000-row browser limit.");
  if (columns.length > LIMITS.columns)
    throw new Error("Dataset exceeds the 200-column browser limit.");
  return rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c, row[c] ?? null])),
  );
}

export function profileRows(rows: DataRow[]): ColumnProfile[] {
  const columns = Object.keys(rows[0] ?? {});
  return columns.map((originalName) => {
    const vals = rows.map((r) => r[originalName] ?? null);
    const role = inferRole(originalName, vals);
    const present = vals.filter((v) => !missing(v));
    const nums = present.filter((v) => parseNumber(v) !== null).length;
    const dates = present.filter(
      (v) =>
        parseDate(v, "DMY").value !== null ||
        parseDate(v, "MDY").value !== null,
    ).length;
    const ambiguous =
      role === "date" && present.some((v) => parseDate(v).ambiguous);
    return {
      originalName,
      canonicalName: slug(originalName),
      inferredRole: role,
      dataType:
        role === "date" && dates
          ? "date"
          : nums === present.length && present.length
            ? "number"
            : present.every((v) => typeof v === "boolean")
              ? "boolean"
              : nums || dates
                ? "mixed"
                : "string",
      nullCount: vals.length - present.length,
      uniqueCount: new Set(present.map(String)).size,
      examples: present.slice(0, 3),
      ambiguity: ambiguous
        ? "Contains dates where day and month are both 12 or below. Choose DMY or MDY."
        : undefined,
    };
  });
}

export function normalizeRows(rows: DataRow[], mappings: FieldMapping[]) {
  const seen = new Set<string>();
  const normalized: DataRow[] = [];
  let exactDuplicates = 0;
  let ambiguousDates = 0;
  for (const row of rows) {
    const out: DataRow = {};
    for (const map of mappings) {
      const value = row[map.originalName];
      if (map.role === "date") {
        const parsed = parseDate(value, map.dateLocale);
        if (parsed.ambiguous) ambiguousDates++;
        out[map.canonicalName] =
          parsed.value ?? (missing(value) ? null : String(value));
      } else if (
        [
          "revenue",
          "expense",
          "refund",
          "balance",
          "amount",
          "number",
        ].includes(map.role)
      )
        out[map.canonicalName] = parseNumber(value);
      else if (map.role === "boolean")
        out[map.canonicalName] = /^(true|yes|1)$/i.test(String(value));
      else
        out[map.canonicalName] = missing(value) ? null : String(value).trim();
    }
    const key = JSON.stringify(out);
    if (seen.has(key)) exactDuplicates++;
    else {
      seen.add(key);
      normalized.push(out);
    }
  }
  return { rows: normalized, exactDuplicates, ambiguousDates };
}

function numericValues(rows: DataRow[], key: string) {
  return rows
    .map((r) => (typeof r[key] === "number" ? (r[key] as number) : null))
    .filter((v): v is number => v !== null);
}
export function validate(
  rows: DataRow[],
  profiles: ColumnProfile[],
  mappings: FieldMapping[],
  exactDuplicates: number,
  ambiguousDates: number,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const required = mappings.filter((m) =>
    ["identifier", "date", "revenue", "expense", "amount"].includes(m.role),
  );
  for (const m of required) {
    const count = rows.filter((r) => missing(r[m.canonicalName])).length;
    results.push({
      ruleId: `missing:${m.canonicalName}`,
      label: `Completeness · ${m.canonicalName}`,
      severity: count ? "warning" : "info",
      status: count ? "review" : "pass",
      count,
      message: count
        ? `${count} rows are missing ${m.canonicalName}.`
        : "No missing values in this key field.",
      evidence: { column: m.canonicalName },
    });
  }
  results.push({
    ruleId: "duplicate:exact",
    label: "Exact duplicate rows",
    severity: exactDuplicates ? "warning" : "info",
    status: exactDuplicates ? "fail" : "pass",
    count: exactDuplicates,
    message: exactDuplicates
      ? `${exactDuplicates} exact rows were removed automatically.`
      : "No exact duplicates found.",
    evidence: {},
  });
  if (ambiguousDates)
    results.push({
      ruleId: "date:ambiguous",
      label: "Ambiguous date formats",
      severity: "error",
      status: "review",
      count: ambiguousDates,
      message: "Choose DMY or MDY before these values can be normalized.",
      evidence: {
        column: mappings.find((m) => m.role === "date")?.canonicalName,
      },
    });
  const futureRows: number[] = [];
  const today = new Date().toISOString().slice(0, 10);
  mappings
    .filter((m) => m.role === "date")
    .forEach((m) =>
      rows.forEach((r, i) => {
        if (
          typeof r[m.canonicalName] === "string" &&
          (r[m.canonicalName] as string) > today
        )
          futureRows.push(i + 1);
      }),
    );
  results.push({
    ruleId: "date:future",
    label: "Future dates",
    severity: futureRows.length ? "warning" : "info",
    status: futureRows.length ? "review" : "pass",
    count: futureRows.length,
    message: futureRows.length
      ? `${futureRows.length} future-dated rows need review.`
      : "No unexpected future dates.",
    evidence: { rowIndexes: futureRows.slice(0, 20) },
  });
  for (const m of mappings.filter((x) =>
    ["revenue", "expense", "refund", "balance", "amount", "number"].includes(
      x.role,
    ),
  )) {
    const vals = numericValues(rows, m.canonicalName).sort((a, b) => a - b);
    if (vals.length > 3) {
      const q1 = vals[Math.floor(vals.length * 0.25)] ?? 0,
        q3 = vals[Math.floor(vals.length * 0.75)] ?? 0,
        iqr = q3 - q1,
        lo = q1 - 1.5 * iqr,
        hi = q3 + 1.5 * iqr;
      const count = vals.filter((v) => v < lo || v > hi).length;
      results.push({
        ruleId: `anomaly:${m.canonicalName}`,
        label: `IQR anomalies · ${m.canonicalName}`,
        severity: count ? "warning" : "info",
        status: count ? "review" : "pass",
        count,
        message: count
          ? `${count} values fall outside ${lo.toFixed(2)}–${hi.toFixed(2)}.`
          : "No IQR outliers detected.",
        evidence: { column: m.canonicalName },
      });
    }
  }
  void profiles;
  return results;
}

export function buildDashboard(
  rows: DataRow[],
  mappings: FieldMapping[],
  validations: ValidationResult[],
): DashboardSpec {
  const amountMaps = mappings.filter((m) =>
    ["revenue", "expense", "refund", "balance", "amount"].includes(m.role),
  );
  const currencyKey = mappings.find(
    (m) => m.role === "currency",
  )?.canonicalName;
  const currencies = [
    ...new Set(
      rows
        .map((row) => (currencyKey ? row[currencyKey] : null))
        .filter((x): x is string => typeof x === "string"),
    ),
  ];
  const unsafeMultiCurrency = currencies.length > 1;
  const kpis: DashboardSpec["kpis"] = [
    {
      id: "rows",
      label: "Usable rows",
      value: rows.length,
      format: "number",
      evidence: "Normalized dataset row count",
    },
    {
      id: "quality",
      label: "Quality pass rate",
      value: validations.length
        ? validations.filter((v) => v.status === "pass").length /
          validations.length
        : 1,
      format: "percent",
      evidence: `${validations.filter((v) => v.status === "pass").length} of ${validations.length} rules passed`,
    },
  ];
  if (!unsafeMultiCurrency)
    for (const m of amountMaps.slice(0, 3)) {
      const total = numericValues(rows, m.canonicalName).reduce(
        (a, b) => a + b,
        0,
      );
      kpis.push({
        id: m.role,
        label: m.role[0]!.toUpperCase() + m.role.slice(1),
        value: total,
        format: "currency",
        currency: currencies[0] ?? "USD",
        evidence: `Sum of ${m.canonicalName} across ${rows.length} normalized rows`,
      });
    }
  else
    kpis.push({
      id: "currencies",
      label: "Currencies kept separate",
      value: currencies.join(", "),
      format: "text",
      evidence:
        "No conversion rules supplied; totals are intentionally not combined",
    });
  const date = mappings.find((m) => m.role === "date"),
    amount = amountMaps[0],
    category = mappings.find(
      (m) => m.role === "category" || m.role === "status",
    );
  const trendMap = new Map<string, number>();
  if (date && amount)
    rows.forEach((r) => {
      const d = String(r[date.canonicalName] ?? "Unknown").slice(0, 7);
      trendMap.set(
        d,
        (trendMap.get(d) ?? 0) +
          (typeof r[amount.canonicalName] === "number"
            ? (r[amount.canonicalName] as number)
            : 0),
      );
    });
  const breakdownMap = new Map<string, number>();
  if (category)
    rows.forEach((r) => {
      const k = String(r[category.canonicalName] ?? "Missing");
      breakdownMap.set(k, (breakdownMap.get(k) ?? 0) + 1);
    });
  const issues = validations
    .filter((v) => v.status !== "pass")
    .reduce((a, v) => a + v.count, 0);
  return {
    kpis,
    trend: [...trendMap]
      .sort()
      .map(([label, value]) => ({ label, value }))
      .slice(-12),
    breakdown: [...breakdownMap]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value })),
    insights: [
      {
        id: "quality",
        title: issues
          ? "Quality review is required"
          : "Dataset is analysis-ready",
        detail: issues
          ? `${issues} row-level or rule-level exceptions need a decision.`
          : "All configured checks passed.",
        evidence: "Validation findings",
        tone: issues ? "warning" : "positive",
      },
      {
        id: "privacy",
        title: "Analysis stayed on this device",
        detail: "Rows were parsed, normalized, and aggregated in your browser.",
        evidence: "Workflow trace · local processing",
        tone: "neutral",
      },
      ...(unsafeMultiCurrency
        ? [
            {
              id: "currency",
              title: "Currency totals are separated",
              detail:
                "Multiple currencies were found and no conversion rule was provided.",
              evidence: `Currency column · ${currencies.join(", ")}`,
              tone: "warning" as const,
            },
          ]
        : []),
    ],
  };
}

async function checksum(rows: DataRow[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function analyzeRows(
  rows: DataRow[],
  file: {
    name: string;
    size: number;
    type: "csv" | "xlsx" | "json" | "sample";
  },
  customMappings?: FieldMapping[],
): Promise<AnalysisRun> {
  const profiles = profileRows(rows);
  const mappings =
    customMappings ??
    profiles.map((p) => ({
      originalName: p.originalName,
      canonicalName: p.canonicalName,
      role: p.inferredRole,
      dateLocale: p.ambiguity ? undefined : "ISO",
    }));
  const normalized = normalizeRows(rows, mappings);
  const validations = validate(
    normalized.rows,
    profiles,
    mappings,
    normalized.exactDuplicates,
    normalized.ambiguousDates,
  );
  const now = new Date().toISOString();
  const trace: TransformationEvent[] = [
    {
      id: "import",
      step: "Import",
      at: now,
      beforeCount: 0,
      afterCount: rows.length,
      detail: `Read ${file.name} locally`,
    },
    {
      id: "profile",
      step: "Profile",
      at: now,
      beforeCount: rows.length,
      afterCount: rows.length,
      detail: `Inferred ${profiles.length} column roles`,
    },
    {
      id: "normalize",
      step: "Normalize",
      at: now,
      beforeCount: rows.length,
      afterCount: normalized.rows.length,
      detail: `Removed ${normalized.exactDuplicates} exact duplicates; preserved source headers in schema`,
    },
    {
      id: "validate",
      step: "Validate",
      at: now,
      beforeCount: normalized.rows.length,
      afterCount: normalized.rows.length,
      detail: `Ran ${validations.length} evidence-backed checks`,
    },
  ];
  const workflow: WorkflowRecipe = {
    id: crypto.randomUUID(),
    name: "Business analysis standard",
    schemaVersion: SCHEMA_VERSION,
    steps: [
      ["Import", `Read ${rows.length} rows`],
      ["Profile", `Inferred ${profiles.length} fields`],
      ["Map", "Review semantic roles"],
      ["Normalize", `${normalized.exactDuplicates} exact duplicates removed`],
      [
        "Validate",
        `${validations.filter((v) => v.status !== "pass").length} checks need review`,
      ],
      ["Analyze", "Built KPIs and evidence"],
      ["Export", "Reproducible bundle ready"],
    ].map(([label, detail], i) => ({
      id: String(i + 1),
      label: label!,
      detail: detail!,
      enabled: true,
      status:
        i === 2 && profiles.some((p) => p.ambiguity) ? "review" : "complete",
    })),
  };
  return {
    id: crypto.randomUUID(),
    manifest: {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      rowCount: rows.length,
      columnCount: profiles.length,
      importedAt: now,
      checksum: await checksum(rows),
      schemaVersion: SCHEMA_VERSION,
    },
    profiles,
    mappings,
    rows,
    normalizedRows: normalized.rows,
    validations,
    dashboard: buildDashboard(normalized.rows, mappings, validations),
    workflow,
    trace,
  };
}
