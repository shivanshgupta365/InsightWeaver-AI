/// <reference lib="webworker" />
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/web-worker";
import { analyzeRows, LIMITS } from "../lib/engine";
import type { CellValue, DataRow, FieldMapping } from "../types";

type Request =
  | { id: string; kind: "file"; file: File }
  | {
      id: string;
      kind: "rows";
      rows: DataRow[];
      file: {
        name: string;
        size: number;
        type: "csv" | "xlsx" | "json" | "sample";
      };
      mappings?: FieldMapping[];
    };
const missing = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === "";
function fromMatrix(matrix: unknown[][]): DataRow[] {
  const raw = (matrix[0] ?? []).map((x, i) =>
    String(x || `column_${i + 1}`).trim(),
  );
  const seen = new Map<string, number>();
  const headers = raw.map((h) => {
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h}_${n}`;
  });
  return matrix
    .slice(1)
    .filter((row) => row.some((v) => !missing(v)))
    .map((row) =>
      Object.fromEntries(
        headers.map((h, i) => [h, (row[i] ?? null) as CellValue]),
      ),
    );
}
async function parse(file: File) {
  if (file.size > LIMITS.bytes)
    throw new Error("File exceeds the 25 MB browser limit.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rows: DataRow[];
  if (ext === "csv") {
    const result = Papa.parse<DataRow>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h, i) => h.trim() || `column_${i + 1}`,
    });
    if (result.errors.length)
      throw new Error(result.errors[0]?.message ?? "Malformed CSV.");
    rows = result.data;
  } else if (ext === "json") {
    const value: unknown = JSON.parse(await file.text());
    if (
      !Array.isArray(value) ||
      value.some((x) => typeof x !== "object" || x === null || Array.isArray(x))
    )
      throw new Error("JSON must be an array of objects.");
    rows = value as DataRow[];
  } else if (ext === "xlsx")
    rows = fromMatrix((await readXlsxFile(file)) as unknown[][]);
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
  return {
    rows: rows.map((row) =>
      Object.fromEntries(columns.map((c) => [c, row[c] ?? null])),
    ),
    ext: ext as "csv" | "xlsx" | "json",
  };
}
self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.kind === "file") {
      const { rows, ext } = await parse(request.file);
      const result = await analyzeRows(rows, {
        name: request.file.name,
        size: request.file.size,
        type: ext,
      });
      self.postMessage({ id: request.id, result });
    } else {
      const result = await analyzeRows(
        request.rows,
        request.file,
        request.mappings,
      );
      self.postMessage({ id: request.id, result });
    }
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : "Processing failed.",
    });
  }
};
