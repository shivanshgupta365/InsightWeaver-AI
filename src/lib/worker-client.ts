import type { AnalysisRun, DataRow, FieldMapping } from "../types";

type WorkerResponse = { id: string; result?: AnalysisRun; error?: string };
export function processFile(file: File): Promise<AnalysisRun> {
  return request({ kind: "file", file });
}
export function reprocessRows(
  rows: DataRow[],
  file: {
    name: string;
    size: number;
    type: "csv" | "xlsx" | "json" | "sample";
  },
  mappings?: FieldMapping[],
): Promise<AnalysisRun> {
  return request({ kind: "rows", rows, file, mappings });
}
function request(payload: Record<string, unknown>): Promise<AnalysisRun> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/analysis.worker.ts", import.meta.url),
      { type: "module" },
    );
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      worker.terminate();
      reject(
        new Error("Processing timed out. Your source file was not changed."),
      );
    }, 30_000);
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      clearTimeout(timer);
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.result) resolve(event.data.result);
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error("The processing worker stopped unexpectedly."));
    };
    worker.postMessage({ id, ...payload });
  });
}
