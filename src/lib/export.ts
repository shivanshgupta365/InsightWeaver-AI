import { strToU8, zipSync } from "fflate";
import Papa from "papaparse";
import type {
  AiAnalysis,
  AnalysisRun,
  ArtifactManifest,
  Project,
} from "../types";
import { SCHEMA_VERSION } from "../types";

export function deterministicBrief(
  project: Project,
  run: AnalysisRun,
): AiAnalysis {
  const failures = run.validations.filter((v) => v.status !== "pass");
  const top = run.dashboard.kpis
    .slice(0, 4)
    .map(
      (k) =>
        `${k.label}: ${typeof k.value === "number" ? k.value.toLocaleString() : k.value}`,
    )
    .join("; ");
  return {
    executiveSummary: `${project.name} contains ${run.manifest.rowCount.toLocaleString()} source rows and ${run.normalizedRows.length.toLocaleString()} analysis-ready rows. ${failures.length ? `${failures.length} quality checks require review.` : "Configured quality checks passed."} ${top}.`,
    findings: run.dashboard.insights.map((i) => ({
      statement: `${i.title}: ${i.detail}`,
      evidenceRefs: [i.evidence],
    })),
    risks: failures
      .slice(0, 5)
      .map((v) => ({ statement: v.message, evidenceRefs: [v.ruleId] })),
    recommendedActions: failures.length
      ? [
          {
            action:
              "Resolve reviewed validation findings before using the analysis in a decision.",
            evidenceRefs: failures.map((v) => v.ruleId).slice(0, 5),
          },
        ]
      : [
          {
            action:
              "Share the reproducible artifact bundle with decision-makers.",
            evidenceRefs: ["workflow:export"],
          },
        ],
    assumptions: [
      "No currency conversion was performed unless a single currency was present.",
      "Only exact duplicate rows were removed automatically.",
    ],
    provider: "deterministic",
    generatedAt: new Date().toISOString(),
  };
}
export function briefMarkdown(ai: AiAnalysis) {
  return `# Executive brief\n\n_Generated ${new Date(ai.generatedAt).toLocaleString()} · ${ai.provider} analysis_\n\n## Executive summary\n\n${ai.executiveSummary}\n\n## Findings\n\n${ai.findings.map((x) => `- ${x.statement}  \n  Evidence: ${x.evidenceRefs.join(", ")}`).join("\n")}\n\n## Risks\n\n${ai.risks.length ? ai.risks.map((x) => `- ${x.statement}  \n  Evidence: ${x.evidenceRefs.join(", ")}`).join("\n") : "- No material data-quality risks identified."}\n\n## Recommended actions\n\n${ai.recommendedActions.map((x) => `- ${x.action}  \n  Evidence: ${x.evidenceRefs.join(", ")}`).join("\n")}\n\n## Assumptions\n\n${ai.assumptions.map((x) => `- ${x}`).join("\n")}\n`;
}
export function createArtifactBundle(project: Project, run: AnalysisRun) {
  const report = {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    manifest: run.manifest,
    summary: run.dashboard.kpis,
    insights: run.dashboard.insights,
    generatedAt: new Date().toISOString(),
  };
  const ai = run.ai ?? deterministicBrief(project, run);
  const docs: Record<string, string> = {
    "normalized.csv": Papa.unparse(run.normalizedRows, {
      escapeFormulae: true,
    }),
    "schema.json": JSON.stringify(
      {
        schemaVersion: SCHEMA_VERSION,
        columns: run.profiles,
        mappings: run.mappings,
      },
      null,
      2,
    ),
    "validation.json": JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, results: run.validations },
      null,
      2,
    ),
    "dashboard.json": JSON.stringify(
      { ...run.dashboard, schemaVersion: SCHEMA_VERSION },
      null,
      2,
    ),
    "report.json": JSON.stringify(report, null, 2),
    "workflow.json": JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, recipe: run.workflow, trace: run.trace },
      null,
      2,
    ),
    "executive-brief.md": briefMarkdown(ai),
  };
  const artifacts = Object.entries(docs).map(([name, body]) => ({
    name,
    mediaType: name.endsWith(".json")
      ? "application/json"
      : name.endsWith(".csv")
        ? "text/csv"
        : "text/markdown",
    bytes: new TextEncoder().encode(body).length,
  }));
  const manifest: ArtifactManifest = {
    schemaVersion: SCHEMA_VERSION,
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    artifacts,
  };
  docs["manifest.json"] = JSON.stringify(manifest, null, 2);
  return new Blob(
    [
      zipSync(
        Object.fromEntries(
          Object.entries(docs).map(([k, v]) => [k, strToU8(v)]),
        ),
        { level: 6 },
      ),
    ],
    { type: "application/zip" },
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
