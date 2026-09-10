import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Cloud,
  Database,
  FileSpreadsheet,
  FolderClock,
  Github,
  LockKeyhole,
  Menu,
  Network,
  PanelTop,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { analyzeRows } from "./lib/engine";
import { processFile, reprocessRows } from "./lib/worker-client";
import {
  createArtifactBundle,
  deterministicBrief,
  downloadBlob,
} from "./lib/export";
import { displayMetric } from "./lib/format";
import {
  cloudConfigured,
  currentUser,
  signInWithEmail,
  signOut,
  syncProject,
} from "./lib/cloud";
import { showcases } from "./lib/samples";
import { deleteProject, listProjects, saveProject } from "./lib/storage";
import type {
  AiAnalysis,
  AnalysisContext,
  FieldMapping,
  Project,
  SemanticRole,
} from "./types";
import { SCHEMA_VERSION } from "./types";

type View = "home" | "workspace" | "history" | "case-study" | "privacy";
const roles: SemanticRole[] = [
  "identifier",
  "date",
  "revenue",
  "expense",
  "refund",
  "balance",
  "amount",
  "currency",
  "category",
  "status",
  "text",
  "number",
  "boolean",
];
const steps = [
  "Import",
  "Map",
  "Quality",
  "Workflow",
  "Dashboard",
  "AI brief",
  "Export",
];

function App() {
  const [view, setView] = useState<View>("home");
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Project[]>([]);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    void listProjects().then(setHistory);
  }, [project]);
  async function openSample(id: string) {
    const sample = showcases.find((x) => x.id === id)!;
    setBusy(true);
    const actual = await analyzeRows(sample.rows, {
      name: `${sample.id}-showcase.json`,
      type: "sample",
      size: new Blob([JSON.stringify(sample.rows)]).size,
    });
    const p: Project = {
      id: crypto.randomUUID(),
      name: sample.title,
      description: sample.summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      source: "guest",
      run: actual,
    };
    await saveProject(p);
    setProject(p);
    setStep(4);
    setView("workspace");
    setBusy(false);
  }
  async function importFile(file: File) {
    setError("");
    setBusy(true);
    try {
      const run = await processFile(file);
      const p: Project = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        description: "Imported browser-local analysis",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        source: "guest",
        run,
      };
      await saveProject(p);
      setProject(p);
      setStep(1);
      setView("workspace");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process this file.");
    } finally {
      setBusy(false);
    }
  }
  function go(next: View) {
    setView(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="app-shell">
      <Header view={view} go={go} menu={menu} setMenu={setMenu} />
      {view === "home" && (
        <Landing
          openSample={openSample}
          importFile={importFile}
          busy={busy}
          error={error}
        />
      )}{" "}
      {view === "workspace" && project?.run && (
        <Workspace
          project={project}
          setProject={setProject}
          step={step}
          setStep={setStep}
        />
      )}{" "}
      {view === "history" && (
        <History
          projects={history}
          onOpen={(p) => {
            setProject(p);
            setStep(4);
            setView("workspace");
          }}
          onDelete={async (id) => {
            await deleteProject(id);
            setHistory(await listProjects());
          }}
        />
      )}
      {view === "case-study" && <CaseStudy />}
      {view === "privacy" && <Privacy />}
    </div>
  );
}

function Header({
  view,
  go,
  menu,
  setMenu,
}: {
  view: View;
  go: (v: View) => void;
  menu: boolean;
  setMenu: (v: boolean) => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => go("home")}>
        <span className="brand-mark">
          <Network size={19} />
        </span>
        <span>InsightWeaver</span>
        <small>BETA</small>
      </button>
      <nav className={menu ? "nav open" : "nav"} aria-label="Primary">
        <button
          className={view === "home" ? "active" : ""}
          onClick={() => go("home")}
        >
          Product
        </button>
        <button
          className={view === "history" ? "active" : ""}
          onClick={() => go("history")}
        >
          Local projects
        </button>
        <button
          className={view === "case-study" ? "active" : ""}
          onClick={() => go("case-study")}
        >
          Case study
        </button>
        <button
          className={view === "privacy" ? "active" : ""}
          onClick={() => go("privacy")}
        >
          Privacy
        </button>
        <a
          href="https://github.com/shivanshgupta365/InsightWeaver-AI"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} />
          Source
        </a>
      </nav>
      <button
        className="menu-btn"
        onClick={() => setMenu(!menu)}
        aria-label="Toggle navigation"
      >
        {menu ? <X /> : <Menu />}
      </button>
    </header>
  );
}

function Landing({
  openSample,
  importFile,
  busy,
  error,
}: {
  openSample: (id: string) => void;
  importFile: (f: File) => void;
  busy: boolean;
  error: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <main>
      <section className="hero">
        <div className="eyebrow">
          <ShieldCheck size={14} /> Private by default · evidence by design
        </div>
        <h1>
          Turn messy data into
          <br />
          <em>decision-ready work.</em>
        </h1>
        <p>
          Profile, clean, validate, explain, and export real CSV, XLSX, or JSON
          data. Your file stays in your browser unless you explicitly choose
          cloud sync.
        </p>
        <div className="hero-actions">
          <button
            className="primary"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload size={18} />
            {busy ? "Processing…" : "Analyze a file"}
          </button>
          <button className="secondary" onClick={() => openSample("sales")}>
            Open 3-minute demo
            <ArrowRight size={17} />
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={(e) =>
              e.target.files?.[0] && void importFile(e.target.files[0])
            }
          />
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="limits">
          <span>
            <LockKeyhole size={14} /> Browser-local processing
          </span>
          <span>25 MB max</span>
          <span>100,000 rows</span>
          <span>200 columns</span>
        </div>
      </section>
      <section className="proof-strip">
        <div>
          <strong>7</strong>
          <span>Auditable workflow steps</span>
        </div>
        <div>
          <strong>0</strong>
          <span>Rows sent to AI by default</span>
        </div>
        <div>
          <strong>8</strong>
          <span>Reproducible artifacts</span>
        </div>
        <div>
          <strong>3</strong>
          <span>Career-ready case studies</span>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">Choose your interview story</span>
            <h2>Three roles. Real analytical evidence.</h2>
          </div>
          <p>
            Every showcase is synthetic and clearly labelled. Open one, inspect
            the logic, and download the work.
          </p>
        </div>
        <div className="sample-grid">
          {showcases.map((s, i) => (
            <article className="sample-card" key={s.id}>
              <div className="sample-no">0{i + 1}</div>
              <span className="role-pill">{s.role}</span>
              <h3>{s.title}</h3>
              <p>{s.summary}</p>
              <div className="sample-outcome">
                <Check size={15} />
                {s.outcome}
              </div>
              <button onClick={() => openSample(s.id)}>
                Open live sample
                <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="section workflow-intro">
        <div>
          <span className="kicker">A method you can defend</span>
          <h2>
            From source file to
            <br />
            boardroom answer.
          </h2>
          <p>
            Each transformation records what changed, when it changed, and the
            row counts before and after.
          </p>
        </div>
        <ol>
          {steps.map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              <div>
                <strong>{s}</strong>
                <small>
                  {
                    [
                      "Read actual CSV, XLSX, or JSON",
                      "Confirm inferred field meaning",
                      "Review exceptions and anomalies",
                      "Inspect the repeatable recipe",
                      "Trace every KPI to its source",
                      "Generate with explicit consent",
                      "Download the complete evidence pack",
                    ][i]
                  }
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Workspace({
  project,
  setProject,
  step,
  setStep,
}: {
  project: Project;
  setProject: (p: Project) => void;
  step: number;
  setStep: (n: number) => void;
}) {
  const run = project.run!;
  async function updateMappings(mappings: FieldMapping[]) {
    const nextRun = await reprocessRows(
      run.rows,
      {
        name: run.manifest.fileName,
        type: run.manifest.fileType,
        size: run.manifest.fileSize,
      },
      mappings,
    );
    const next = {
      ...project,
      updatedAt: new Date().toISOString(),
      run: nextRun,
    };
    await saveProject(next);
    setProject(next);
  }
  return (
    <main className="workspace">
      <div className="workspace-head">
        <button className="back" onClick={() => history.back()}>
          <ArrowLeft size={16} />
          Exit workspace
        </button>
        <div>
          <span className="kicker">Local project</span>
          <h1>{project.name}</h1>
          <p>
            {run.manifest.rowCount.toLocaleString()} rows ·{" "}
            {run.manifest.columnCount} columns ·{" "}
            {run.manifest.fileType.toUpperCase()} · schema v
            {project.schemaVersion}
          </p>
        </div>
        <span className="privacy-chip">
          <LockKeyhole size={14} />
          On this device
        </span>
      </div>
      <div className="stepper" role="tablist">
        {steps.map((s, i) => (
          <button
            key={s}
            className={step === i ? "active" : i < step ? "done" : ""}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Check size={13} /> : i + 1}</span>
            {s}
          </button>
        ))}
      </div>
      <div className="work-area">
        {step === 0 && <ImportSummary project={project} />}{" "}
        {step === 1 && <Mapping project={project} onSave={updateMappings} />}{" "}
        {step === 2 && <Quality project={project} />}{" "}
        {step === 3 && <Workflow project={project} />}{" "}
        {step === 4 && <Dashboard project={project} />}{" "}
        {step === 5 && <AiPanel project={project} setProject={setProject} />}{" "}
        {step === 6 && <ExportPanel project={project} />}
      </div>
      <div className="work-nav">
        <button
          className="secondary"
          disabled={step === 0}
          onClick={() => setStep(Math.max(0, step - 1))}
        >
          <ArrowLeft size={16} />
          Previous
        </button>
        <span>
          Step {step + 1} of {steps.length}
        </span>
        <button
          className="primary"
          disabled={step === 6}
          onClick={() => setStep(Math.min(6, step + 1))}
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </main>
  );
}

function ImportSummary({ project }: { project: Project }) {
  const m = project.run!.manifest;
  return (
    <Panel
      title="Source captured"
      eyebrow="01 · Import"
      intro="This run was built from the actual source data, not a preset report."
    >
      <div className="source-card">
        <FileSpreadsheet size={28} />
        <div>
          <strong>{m.fileName}</strong>
          <span>
            {(m.fileSize / 1024).toFixed(1)} KB · imported{" "}
            {new Date(m.importedAt).toLocaleString()}
          </span>
        </div>
        <span className="success">
          <Check size={14} />
          Accepted
        </span>
      </div>
      <div className="stat-grid">
        <Stat label="Source rows" value={m.rowCount} />
        <Stat label="Columns" value={m.columnCount} />
        <Stat label="Format" value={m.fileType.toUpperCase()} />
        <Stat label="Fingerprint" value={m.checksum.slice(0, 10)} />
      </div>
    </Panel>
  );
}
function Mapping({
  project,
  onSave,
}: {
  project: Project;
  onSave: (m: FieldMapping[]) => void;
}) {
  const [maps, setMaps] = useState(project.run!.mappings);
  const ambiguous = project.run!.profiles.filter((p) => p.ambiguity);
  return (
    <Panel
      title="Confirm what each field means"
      eyebrow="02 · Semantic mapping"
      intro="Canonical names drive the analysis. Original headers stay in the exported schema."
    >
      {ambiguous.length > 0 && (
        <div className="notice warning">
          <strong>Date choice required</strong>
          <span>
            {ambiguous.map((x) => x.originalName).join(", ")} contains values
            that could mean either day/month or month/day.
          </span>
        </div>
      )}
      <div className="mapping-table table-wrap">
        <table>
          <thead>
            <tr>
              <th>Original field</th>
              <th>Canonical field</th>
              <th>Semantic role</th>
              <th>Profile</th>
              <th>Date locale</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m, i) => {
              const p = project.run!.profiles[i]!;
              return (
                <tr key={m.originalName}>
                  <td>
                    <strong>{m.originalName}</strong>
                    <small>{p.examples.map(String).join(" · ")}</small>
                  </td>
                  <td>
                    <input
                      value={m.canonicalName}
                      onChange={(e) =>
                        setMaps((v) =>
                          v.map((x, j) =>
                            j === i
                              ? { ...x, canonicalName: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setMaps((v) =>
                          v.map((x, j) =>
                            j === i
                              ? { ...x, role: e.target.value as SemanticRole }
                              : x,
                          ),
                        )
                      }
                    >
                      {roles.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="type">{p.dataType}</span>
                    <small>
                      {p.nullCount} missing · {p.uniqueCount} unique
                    </small>
                  </td>
                  <td>
                    {m.role === "date" ? (
                      <select
                        value={m.dateLocale ?? ""}
                        onChange={(e) =>
                          setMaps((v) =>
                            v.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    dateLocale: e.target.value as
                                      | "DMY"
                                      | "MDY"
                                      | "ISO",
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="">Choose…</option>
                        <option value="ISO">ISO</option>
                        <option value="DMY">Day / month</option>
                        <option value="MDY">Month / day</option>
                      </select>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="primary" onClick={() => void onSave(maps)}>
        <Check size={16} />
        Apply mapping and rerun
      </button>
    </Panel>
  );
}
function Quality({ project }: { project: Project }) {
  const v = project.run!.validations;
  return (
    <Panel
      title="Quality findings, with evidence"
      eyebrow="03 · Validation"
      intro="InsightWeaver flags exceptions for review. It only removes exact duplicate rows automatically."
    >
      <div className="quality-summary">
        <div className="score-ring">
          <strong>
            {Math.round(
              (v.filter((x) => x.status === "pass").length /
                Math.max(v.length, 1)) *
                100,
            )}
            %
          </strong>
          <span>rules passed</span>
        </div>
        <div>
          <h3>
            {v.filter((x) => x.status !== "pass").length} checks need attention
          </h3>
          <p>
            Review warnings before presenting this analysis or automating a
            downstream action.
          </p>
        </div>
      </div>
      <div className="finding-list">
        {v.map((x) => (
          <div className={`finding ${x.status}`} key={x.ruleId}>
            <span className="finding-icon">
              {x.status === "pass" ? <Check /> : "!"}
            </span>
            <div>
              <strong>{x.label}</strong>
              <p>{x.message}</p>
              <small>Evidence · {x.evidence.column ?? x.ruleId}</small>
            </div>
            <b>{x.count}</b>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function Workflow({ project }: { project: Project }) {
  const r = project.run!;
  return (
    <Panel
      title="A repeatable, inspectable recipe"
      eyebrow="04 · Workflow"
      intro="The step interface keeps automation logic legible to operators, reviewers, and recruiters."
    >
      <div className="recipe">
        {r.workflow.steps.map((s, i) => (
          <div className="recipe-step" key={s.id}>
            <span>{i + 1}</span>
            <div>
              <strong>{s.label}</strong>
              <p>{s.detail}</p>
            </div>
            <b className={s.status}>{s.status}</b>
          </div>
        ))}
      </div>
      <h3 className="subhead">Transformation trace</h3>
      <div className="trace">
        {r.trace.map((t) => (
          <div key={t.id}>
            <time>{new Date(t.at).toLocaleTimeString()}</time>
            <strong>{t.step}</strong>
            <p>{t.detail}</p>
            <span>
              {t.beforeCount} → {t.afterCount} rows
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function Dashboard({ project }: { project: Project }) {
  const d = project.run!.dashboard;
  return (
    <Panel
      title="The decision view"
      eyebrow="05 · Dashboard"
      intro="Every number carries its source. Different currencies remain separate unless you provide conversion rules."
    >
      <div className="kpi-grid">
        {d.kpis.map((k) => (
          <div className="kpi" key={k.id}>
            <span>{k.label}</span>
            <strong>{displayMetric(k.value, k.format, k.currency)}</strong>
            <small>{k.evidence}</small>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Trend</h3>
          <p>Primary amount by month</p>
          <Bars data={d.trend} />
        </div>
        <div className="chart-card">
          <h3>Breakdown</h3>
          <p>Rows by category or status</p>
          <Bars data={d.breakdown} />
        </div>
      </div>
      <div className="insights">
        <h3>Evidence-backed observations</h3>
        {d.insights.map((i) => (
          <div key={i.id} className={`insight ${i.tone}`}>
            <span />
            <div>
              <strong>{i.title}</strong>
              <p>{i.detail}</p>
              <small>Evidence · {i.evidence}</small>
            </div>
          </div>
        ))}
      </div>
      <DataPreview project={project} />
    </Panel>
  );
}
function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((x) => Math.abs(x.value)), 1);
  return (
    <div className="bars">
      {data.length ? (
        data.map((x) => (
          <div key={x.label}>
            <label>
              <span>{x.label}</span>
              <b>{x.value.toLocaleString()}</b>
            </label>
            <i>
              <span
                style={{
                  width: `${Math.max(3, (Math.abs(x.value) / max) * 100)}%`,
                }}
              />
            </i>
          </div>
        ))
      ) : (
        <p className="empty">
          Map a date and numeric field to generate this view.
        </p>
      )}
    </div>
  );
}
function DataPreview({ project }: { project: Project }) {
  const rows = project.run!.normalizedRows.slice(0, 6),
    cols = Object.keys(rows[0] ?? {});
  return (
    <div className="preview">
      <h3>Normalized data preview</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c}>{String(r[c] ?? "—")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>
        Showing {rows.length} of{" "}
        {project.run!.normalizedRows.length.toLocaleString()} rows. Full data is
        included in normalized.csv.
      </small>
    </div>
  );
}
function AiPanel({
  project,
  setProject,
}: {
  project: Project;
  setProject: (p: Project) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = project.run!;
  async function generate() {
    setBusy(true);
    setMessage("");
    let ai: AiAnalysis;
    try {
      const ctx: AnalysisContext = {
        taskType: "executive_brief",
        schemaProfile: run.profiles,
        aggregateMetrics: run.dashboard.kpis,
        validationFindings: run.validations,
        workflowTrace: run.trace,
        consent,
      };
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx),
      });
      const body = (await response.json()) as {
        analysis?: AiAnalysis;
        error?: string;
      };
      if (!response.ok || !body.analysis)
        throw new Error(body.error ?? "AI unavailable");
      ai = body.analysis;
      setMessage(
        ai.provider === "deterministic"
          ? "Gemini was unavailable; the evidence-based fallback was used."
          : "Gemini analysis generated from aggregates only.",
      );
    } catch {
      ai = deterministicBrief(project, run);
      setMessage(
        "Live AI is not configured here, so the deterministic evidence-based brief was generated.",
      );
    }
    const next = {
      ...project,
      updatedAt: new Date().toISOString(),
      run: { ...run, ai },
    };
    await saveProject(next);
    setProject(next);
    setBusy(false);
  }
  return (
    <Panel
      title="Draft an executive brief"
      eyebrow="06 · AI analyst"
      intro="AI receives the schema, aggregate metrics, validation findings, and workflow trace—not your raw file or full row collection."
    >
      <div className="ai-boundary">
        <div>
          <ShieldCheck />
          <strong>Context boundary</strong>
          <p>0 raw files · 0 full datasets · sample rows off</p>
        </div>
        <div>
          <Sparkles />
          <strong>Evidence contract</strong>
          <p>Every finding must reference a KPI, rule, or workflow step</p>
        </div>
      </div>
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          <strong>
            I consent to send the summarized analysis context to Gemini.
          </strong>
          <small>
            The selected Gemini free tier may use submitted context to improve
            Google products. Do not include personal or sensitive data.
          </small>
        </span>
      </label>
      <button
        className="primary"
        disabled={!consent || busy}
        onClick={() => void generate()}
      >
        <Sparkles size={17} />
        {busy ? "Generating…" : "Generate executive brief"}
      </button>
      {message && <p className="notice">{message}</p>}
      {run.ai && <Brief ai={run.ai} />}
    </Panel>
  );
}
function Brief({ ai }: { ai: AiAnalysis }) {
  return (
    <article className="brief">
      <div>
        <span>Executive brief</span>
        <b>
          {ai.provider === "gemini"
            ? "Gemini 2.5 Flash"
            : "Deterministic fallback"}
        </b>
      </div>
      <h3>Executive summary</h3>
      <p>{ai.executiveSummary}</p>
      <h3>Findings</h3>
      {ai.findings.map((f, i) => (
        <p key={i}>
          • {f.statement} <small>[{f.evidenceRefs.join(", ")}]</small>
        </p>
      ))}
      <h3>Recommended actions</h3>
      {ai.recommendedActions.map((a, i) => (
        <p key={i}>• {a.action}</p>
      ))}
    </article>
  );
}
function ExportPanel({ project }: { project: Project }) {
  return (
    <Panel
      title="Take the evidence with you"
      eyebrow="07 · Export"
      intro="The bundle is reproducible, versioned, and derived from this project’s actual normalized rows."
    >
      <div className="artifact-list">
        {[
          "normalized.csv",
          "schema.json",
          "validation.json",
          "dashboard.json",
          "report.json",
          "workflow.json",
          "executive-brief.md",
          "manifest.json",
        ].map((x, i) => (
          <div key={x}>
            <span>{i < 1 ? <FileSpreadsheet /> : <Database />}</span>
            <div>
              <strong>{x}</strong>
              <small>
                {
                  [
                    "Cleaned analysis-ready rows",
                    "Original and canonical field definitions",
                    "Rule results and evidence",
                    "KPIs, trends, and breakdowns",
                    "Portable analysis summary",
                    "Recipe and transformation trace",
                    "Editable decision narrative",
                    "Checksums and schema version",
                  ][i]
                }
              </small>
            </div>
            <Check size={16} />
          </div>
        ))}
      </div>
      <button
        className="primary download"
        onClick={() =>
          downloadBlob(
            createArtifactBundle(project, project.run!),
            `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-artifacts.zip`,
          )
        }
      >
        <ArrowDownToLine />
        Download complete artifact bundle
      </button>
      <p className="fine">
        Formula-like cells are escaped in CSV exports. Schema version{" "}
        {SCHEMA_VERSION} is included in all portable records.
      </p>
    </Panel>
  );
}
function History({
  projects,
  onOpen,
  onDelete,
}: {
  projects: Project[];
  onOpen: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cloudMessage, setCloudMessage] = useState("");
  useEffect(() => {
    void currentUser().then((user) => setUserEmail(user?.email ?? null));
  }, []);
  async function requestSignIn() {
    try {
      await signInWithEmail(email);
      setCloudMessage("Check your email for the secure sign-in link.");
    } catch (error) {
      setCloudMessage(
        error instanceof Error ? error.message : "Sign-in failed.",
      );
    }
  }
  async function sync(project: Project) {
    if (
      !window.confirm(
        "Cloud sync uploads this project summary to private Supabase storage. Raw source rows are not uploaded by this action. Continue?",
      )
    )
      return;
    try {
      const user = await syncProject(project);
      setUserEmail(user.email ?? null);
      setCloudMessage(`${project.name} is now synced privately.`);
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Sync failed.");
    }
  }
  return (
    <main className="page">
      <span className="kicker">IndexedDB · this browser</span>
      <h1>Local projects</h1>
      <p className="lead">
        Projects persist privately on this device and can be reopened offline.
        Cloud sync is optional and requires an account.
      </p>
      <section className="cloud-card">
        <Cloud />
        <div>
          <strong>Optional private cloud</strong>
          {!cloudConfigured ? (
            <p>
              Cloud sync becomes available after the deployment owner connects
              Supabase.
            </p>
          ) : userEmail ? (
            <p>Signed in as {userEmail}. Sync is opt-in per project.</p>
          ) : (
            <p>Enter your email to receive a passwordless sign-in link.</p>
          )}
        </div>
        {cloudConfigured && !userEmail && (
          <>
            <input
              aria-label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="secondary" onClick={() => void requestSignIn()}>
              Send sign-in link
            </button>
          </>
        )}
        {userEmail && (
          <button
            className="secondary"
            onClick={() => void signOut().then(() => setUserEmail(null))}
          >
            Sign out
          </button>
        )}
      </section>
      {cloudMessage && <p className="notice">{cloudMessage}</p>}
      {projects.length ? (
        <div className="history-grid">
          {projects.map((p) => (
            <article key={p.id}>
              <FolderClock />
              <div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <small>
                  {p.run?.manifest.rowCount.toLocaleString()} rows · updated{" "}
                  {new Date(p.updatedAt).toLocaleString()}
                </small>
              </div>
              <button className="secondary" onClick={() => onOpen(p)}>
                Open
              </button>
              {userEmail && (
                <button className="secondary" onClick={() => void sync(p)}>
                  <Cloud size={14} />
                  Sync
                </button>
              )}
              <button className="text-danger" onClick={() => onDelete(p.id)}>
                Delete
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FolderClock />
          <h2>No local projects yet</h2>
          <p>Import a file or open a showcase to create one.</p>
        </div>
      )}
    </main>
  );
}
function CaseStudy() {
  return (
    <main className="page editorial">
      <span className="kicker">Open-source case study</span>
      <h1>
        Analysis people can inspect,
        <br />
        not just admire.
      </h1>
      <p className="lead">
        InsightWeaver was rebuilt around one test: can a candidate defend where
        every insight came from?
      </p>
      <div className="case-grid">
        <article>
          <b>Problem</b>
          <h2>Spreadsheet work is hard to prove.</h2>
          <p>
            Static dashboards hide assumptions, cleaning decisions, and
            data-quality failures. Generic AI summaries make the evidence gap
            worse.
          </p>
        </article>
        <article>
          <b>Product decision</b>
          <h2>The workflow is the portfolio.</h2>
          <p>
            The product exposes mapping, normalization, validation, metrics, and
            exports as one auditable story—useful work and interview evidence at
            once.
          </p>
        </article>
        <article>
          <b>Privacy boundary</b>
          <h2>Local first. Cloud by consent.</h2>
          <p>
            Files process in-browser. Guest projects use IndexedDB. AI sees
            aggregates and rule findings only after an explicit disclosure.
          </p>
        </article>
        <article>
          <b>Correctness</b>
          <h2>Refuse unsafe shortcuts.</h2>
          <p>
            Ambiguous dates require a locale. Currencies stay separate. Revenue,
            expenses, refunds, and balances keep distinct meanings.
          </p>
        </article>
      </div>
      <div className="architecture">
        <h2>System boundary</h2>
        <div>
          <span>
            <PanelTop />
            Browser PWA<small>Parse · profile · validate · export</small>
          </span>
          <ArrowRight />
          <span>
            <Cloud />
            Opt-in services<small>Supabase ownership · Gemini aggregates</small>
          </span>
          <ArrowRight />
          <span>
            <Github />
            Public evidence<small>Tests · docs · versioned contracts</small>
          </span>
        </div>
      </div>
    </main>
  );
}
function Privacy() {
  return (
    <main className="page editorial">
      <span className="kicker">Privacy & controls</span>
      <h1>
        Your file is not
        <br />
        the product.
      </h1>
      <p className="lead">
        Guest analysis runs locally. No raw file leaves your device unless you
        deliberately enable cloud sync.
      </p>
      <div className="policy">
        <section>
          <ShieldCheck />
          <div>
            <h2>Browser-local by default</h2>
            <p>
              Parsing, normalization, validation, dashboard generation, and
              exports happen on your device. Local projects are stored in this
              browser’s IndexedDB.
            </p>
          </div>
        </section>
        <section>
          <Cloud />
          <div>
            <h2>Cloud sync is opt-in</h2>
            <p>
              When configured, authenticated projects use private owner-scoped
              Supabase rows and Storage paths. We do not claim end-to-end
              encryption.
            </p>
          </div>
        </section>
        <section>
          <Sparkles />
          <div>
            <h2>AI requires consent</h2>
            <p>
              The Gemini route rejects raw files and full row collections. It
              accepts a maximum 50 KB of schema profiles, aggregates, findings,
              and workflow evidence.
            </p>
          </div>
        </section>
        <section>
          <Database />
          <div>
            <h2>Delete means delete</h2>
            <p>
              Local projects can be removed instantly. Authenticated deletion is
              idempotent and removes stored artifacts plus project records.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
function Panel({
  title,
  eyebrow,
  intro,
  children,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <span className="kicker">{eyebrow}</span>
      <h2>{title}</h2>
      <p className="panel-intro">{intro}</p>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
    </div>
  );
}
export default App;
