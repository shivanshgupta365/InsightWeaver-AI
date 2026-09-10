export const SCHEMA_VERSION = 1 as const;
export type CellValue = string | number | boolean | null;
export type DataRow = Record<string, CellValue>;
export type SemanticRole =
  | "identifier"
  | "date"
  | "revenue"
  | "expense"
  | "refund"
  | "balance"
  | "amount"
  | "currency"
  | "category"
  | "status"
  | "text"
  | "number"
  | "boolean";

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  source: "guest" | "cloud";
  run?: AnalysisRun;
}
export interface DatasetManifest {
  fileName: string;
  fileType: "csv" | "xlsx" | "json" | "sample";
  fileSize: number;
  rowCount: number;
  columnCount: number;
  importedAt: string;
  checksum: string;
  schemaVersion: number;
}
export interface ColumnProfile {
  originalName: string;
  canonicalName: string;
  inferredRole: SemanticRole;
  dataType: "string" | "number" | "boolean" | "date" | "mixed";
  nullCount: number;
  uniqueCount: number;
  examples: CellValue[];
  ambiguity?: string;
}
export interface FieldMapping {
  originalName: string;
  canonicalName: string;
  role: SemanticRole;
  dateLocale?: "DMY" | "MDY" | "ISO";
}
export interface WorkflowRecipe {
  id: string;
  name: string;
  schemaVersion: number;
  steps: WorkflowStep[];
}
export interface WorkflowStep {
  id: string;
  label: string;
  enabled: boolean;
  status: "complete" | "review" | "pending";
  detail: string;
}
export interface TransformationEvent {
  id: string;
  step: string;
  at: string;
  beforeCount: number;
  afterCount: number;
  detail: string;
}
export interface ValidationRule {
  id: string;
  label: string;
  type:
    | "missing"
    | "type"
    | "range"
    | "future_date"
    | "duplicate"
    | "reconciliation"
    | "anomaly";
  severity: "info" | "warning" | "error";
}
export interface ValidationResult {
  ruleId: string;
  label: string;
  severity: "info" | "warning" | "error";
  status: "pass" | "fail" | "review";
  count: number;
  message: string;
  evidence: { column?: string; rowIndexes?: number[]; value?: string | number };
}
export interface DashboardSpec {
  kpis: {
    id: string;
    label: string;
    value: number | string;
    format: "number" | "currency" | "percent" | "text";
    currency?: string;
    evidence: string;
  }[];
  trend: { label: string; value: number }[];
  breakdown: { label: string; value: number }[];
  insights: EvidenceInsight[];
}
export interface EvidenceInsight {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  tone: "positive" | "neutral" | "warning";
}
export interface ArtifactManifest {
  schemaVersion: number;
  projectId: string;
  generatedAt: string;
  artifacts: { name: string; mediaType: string; bytes: number }[];
}
export interface AnalysisContext {
  taskType: "executive_brief" | "risk_review" | "next_actions";
  schemaProfile: ColumnProfile[];
  aggregateMetrics: DashboardSpec["kpis"];
  validationFindings: ValidationResult[];
  workflowTrace: TransformationEvent[];
  conversationContext?: string;
  consent: boolean;
  redactedSampleRows?: DataRow[];
}
export interface AiAnalysis {
  executiveSummary: string;
  findings: { statement: string; evidenceRefs: string[] }[];
  risks: { statement: string; evidenceRefs: string[] }[];
  recommendedActions: { action: string; evidenceRefs: string[] }[];
  assumptions: string[];
  provider: "gemini" | "deterministic";
  generatedAt: string;
}
export interface AnalysisRun {
  id: string;
  manifest: DatasetManifest;
  profiles: ColumnProfile[];
  mappings: FieldMapping[];
  rows: DataRow[];
  normalizedRows: DataRow[];
  validations: ValidationResult[];
  dashboard: DashboardSpec;
  workflow: WorkflowRecipe;
  trace: TransformationEvent[];
  ai?: AiAnalysis;
}
