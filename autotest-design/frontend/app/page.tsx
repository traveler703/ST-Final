"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Boxes,
  Cpu,
  Download,
  FileSpreadsheet,
  GitBranch,
  Layers3,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Upload
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:28110/api";

type Row = Record<string, unknown>;

type Snapshot = {
  project?: Row;
  requirements: Row[];
  riskAssessments: Row[];
  coverageItems: Row[];
  coverageStrategies: Row[];
  testCases: Row[];
  whiteboxModels: Row[];
  suiteVariants: Row[];
  promptRuns: Row[];
  reviewRevisions: Row[];
};

const emptySnapshot: Snapshot = {
  requirements: [],
  riskAssessments: [],
  coverageItems: [],
  coverageStrategies: [],
  testCases: [],
  whiteboxModels: [],
  suiteVariants: [],
  promptRuns: [],
  reviewRevisions: []
};

const modelOptions = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" }
];

type ViewId = "overview" | "requirements" | "analysis" | "cases" | "models" | "logs";

const workspaceViews: Array<{ id: ViewId; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Project setup, import, and AI pipeline" },
  { id: "requirements", label: "Requirements", description: "Structured requirements and review" },
  { id: "analysis", label: "Risk & Coverage", description: "Risk matrix, coverage items, and strategies" },
  { id: "cases", label: "Test Cases", description: "Generated cases and human review" },
  { id: "models", label: "Artifacts & Export", description: "White-box model, suites, and FR 6.0 exports" },
  { id: "logs", label: "Prompt Log", description: "Model calls, fallbacks, and summaries" }
];

function clampSidebarWidth(value: number) {
  return Math.min(680, Math.max(360, value));
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowList(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => typeof item === "object" && item !== null) : [];
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? res.json() : res.blob();
}

export default function Home() {
  const [projectName, setProjectName] = useState("newbee-mall");
  const [targetApp, setTargetApp] = useState("newbee-mall");
  const [description, setDescription] = useState(
    "E-commerce target application with storefront, user authentication, shopping cart, order, payment, and admin management workflows."
  );
  const [projectId, setProjectId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [manualText, setManualText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState(modelOptions[0].value);
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [sidebarWidth, setSidebarWidth] = useState(440);

  const counts = useMemo(
    () => ({
      requirements: snapshot.requirements.length,
      risks: snapshot.riskAssessments.length,
      coverage: snapshot.coverageItems.length,
      tests: snapshot.testCases.length,
      suites: snapshot.suiteVariants.length
    }),
    [snapshot]
  );
  const activeWorkspace = workspaceViews.find((view) => view.id === activeView) ?? workspaceViews[0];

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function refresh(id = projectId) {
    if (!id) return;
    const data = await api(`/projects/${id}`);
    setSnapshot(data);
  }

  async function createProject() {
    await run("Creating project", async () => {
      const data = await api("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, targetApp, description })
      });
      setProjectId(Number(data.id));
      await refresh(Number(data.id));
    });
  }

  async function importRequirements() {
    if (!projectId) return;
    await run("Importing requirements", async () => {
      const form = new FormData();
      if (file) form.append("file", file);
      if (manualText.trim()) form.append("manualText", manualText);
      form.append("sourceType", file ? "file" : "manual");
      const data = await api(`/projects/${projectId}/requirements/import`, { method: "POST", body: form });
      setSnapshot(data.project);
    });
  }

  async function generate(path: string, label: string, nextView?: ViewId) {
    if (!projectId) return;
    await run(label, async () => {
      const data = await api(`/projects/${projectId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel })
      });
      setSnapshot(data);
      if (nextView) setActiveView(nextView);
    });
  }

  async function exportFile(format: "json" | "csv" | "xlsx") {
    if (!projectId) return;
    await run(`Exporting ${format}`, async () => {
      const res = await fetch(`${API}/projects/${projectId}/exports/${format}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autotestdesign-${projectId}.${format === "xlsx" ? "xlsx" : format}`;
      a.click();
      URL.revokeObjectURL(url);
      await refresh();
    });
  }

  async function patchItem(itemType: string, id: unknown, fieldName: string, value: string) {
    await run("Saving review", async () => {
      await api(`/review-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, fieldName, newValue: value, note: "Edited in AutoTestDesign workbench" })
      });
      await refresh();
    });
  }

  function draftKey(itemType: string, id: unknown, field: string) {
    return `${itemType}:${id}:${field}`;
  }

  function startSidebarResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onPointerMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function EditableCell({
    itemType,
    row,
    field,
    multiline = false
  }: {
    itemType: string;
    row: Row;
    field: string;
    multiline?: boolean;
  }) {
    const key = draftKey(itemType, row.id, field);
    const value = reviewDraft[key] ?? text(row[field]);
    const common = {
      value,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setReviewDraft((draft) => ({ ...draft, [key]: event.target.value }))
    };
    return (
      <div className="reviewEditor">
        {multiline ? <textarea className="input" rows={3} {...common} /> : <input className="input" {...common} />}
        <button className="ghostButton" disabled={busy !== ""} onClick={() => patchItem(itemType, row.id, field, value)}>
          <Pencil size={14} /> Save
        </button>
      </div>
    );
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("autotest-sidebar-width-v2");
    if (saved) setSidebarWidth(clampSidebarWidth(Number(saved)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("autotest-sidebar-width-v2", String(sidebarWidth));
  }, [sidebarWidth]);

  return (
    <div className="appShell" style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)` }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandRow">
            <div className="brandMark">
              <Bot size={22} />
            </div>
            <div>
              <span>Software Testing Lab</span>
              <h1>AutoTestDesign</h1>
            </div>
          </div>
          <p>AI-driven test design with human review, traceability, and export-ready artifacts.</p>
        </div>

        <section className="projectCard">
          <div className="sectionKicker">Project Brief</div>
          <label>Project name</label>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          <label>Target application</label>
          <input value={targetApp} onChange={(e) => setTargetApp(e.target.value)} />
          <label>Testing concept</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
          <button className="button" onClick={createProject} disabled={busy !== ""}>
            <Boxes size={16} /> Create / Reset Project
          </button>
        </section>

        <section className="workspaceNav" aria-label="Workspace sections">
          <div className="sectionKicker">Workspace</div>
          {workspaceViews.map((view, index) => (
            <button
              className={`navItem ${activeView === view.id ? "active" : ""}`}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              <span>{index + 1}</span>
              <span>
                <strong>{view.label}</strong>
                <small>{view.description}</small>
              </span>
            </button>
          ))}
        </section>
        <button
          className="sidebarResizeHandle"
          type="button"
          aria-label="Resize sidebar"
          onPointerDown={startSidebarResize}
        />
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <span className="eyebrow"><Activity size={14} /> Generation cockpit</span>
            <h2>{activeWorkspace.label}</h2>
            <p>
              {snapshot.project ? `${text(snapshot.project.name)} / ${activeWorkspace.description}` : activeWorkspace.description}
            </p>
          </div>
          <div className="topActions">
            <span className="modelPill"><Cpu size={15} /> {selectedModel}</span>
            <button className="ghostButton" onClick={() => refresh()} disabled={!projectId || busy !== ""}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {error && <div className="statusPanel errorState">{error}</div>}
        {busy && <div className="statusPanel busyState">Working: {busy}</div>}

        {activeView === "overview" && (
          <div className="viewStack">
            <section className="metricRow">
              <Metric label="Requirements" value={counts.requirements} />
              <Metric label="Risks" value={counts.risks} />
              <Metric label="Coverage Items" value={counts.coverage} />
              <Metric label="Test Cases" value={counts.tests} />
              <Metric label="Suites" value={counts.suites} />
            </section>

            <section className="twoCol">
              <div className="panel">
                <div className="panelHeader">
                  <h3>Requirement Ingestion</h3>
                  <span>CSV, TXT, XLSX, or manual input</span>
                </div>
                <div className="grid">
                  <input
                    className="input"
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <textarea
                    className="textarea"
                    value={manualText}
                    placeholder="Paste one requirement per line, or upload NewBeeMall_Testable_Areas.xlsx."
                    onChange={(e) => setManualText(e.target.value)}
                  />
                  <button className="button" disabled={!projectId || busy !== ""} onClick={importRequirements}>
                    <Upload size={16} /> Import Requirements
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="panelHeader">
                  <h3>AI Generation Pipeline</h3>
                  <span>Each result is saved as reviewable artifacts</span>
                </div>
                <div className="modelSelector">
                  <label htmlFor="llm-model">LLM model</label>
                  <select
                    id="llm-model"
                    className="select"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    disabled={busy !== ""}
                  >
                    {modelOptions.map((model) => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </select>
                </div>
                <div className="toolbar">
                  <Action onClick={() => generate("/requirements/structure", "Structuring requirements", "requirements")} label="Structure" icon={<Bot size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/risk/analyze", "Analyzing risk", "analysis")} label="Risk" icon={<ShieldCheck size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/coverage/generate", "Generating coverage", "analysis")} label="Coverage" icon={<Layers3 size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/strategies/generate", "Generating strategies", "analysis")} label="Strategies" icon={<GitBranch size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/test-cases/generate", "Generating test cases", "cases")} label="Test Cases" icon={<Play size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/white-box/model", "Generating white-box model", "models")} label="White-box" icon={<GitBranch size={15} />} disabled={!projectId || busy !== ""} />
                  <Action onClick={() => generate("/suite/optimize", "Optimizing suite", "models")} label="Optimize" icon={<Boxes size={15} />} disabled={!projectId || busy !== ""} />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeView === "requirements" && (
          <PanelTable
            title="Requirements"
            subtitle="LLM structured requirements, editable by the designer"
            rows={snapshot.requirements}
            columns={["requirement_key", "module", "role_name", "raw_text", "expected_results", "status"]}
            editable={(row) => <EditableCell itemType="requirement" row={row} field="expected_results" multiline />}
          />
        )}

        {activeView === "analysis" && (
          <div className="viewStack">
            <PanelTable
              title="Risk Matrix"
              subtitle="Impact, likelihood, complexity, detectability, score, priority"
              rows={snapshot.riskAssessments}
              columns={["requirement_id", "impact", "likelihood", "complexity", "detectability", "risk_score", "priority", "rationale", "status"]}
              editable={(row) => <EditableCell itemType="risk" row={row} field="priority" />}
            />
            <PanelTable
              title="Coverage Workshop"
              subtitle="Coverage items and selected strategies"
              rows={snapshot.coverageItems}
              columns={["id", "requirement_id", "coverage_type", "description", "rationale", "status"]}
              editable={(row) => <EditableCell itemType="coverage" row={row} field="description" multiline />}
            />
            <PanelTable
              title="Strategy Map"
              subtitle="Selected testing techniques per coverage item"
              rows={snapshot.coverageStrategies}
              columns={["coverage_item_id", "techniques", "rationale", "status"]}
            />
          </div>
        )}

        {activeView === "cases" && (
          <PanelTable
            title="Test Case Studio"
            subtitle="Generated test cases with oracle explanations and traceability"
            rows={snapshot.testCases}
            columns={["test_case_key", "requirement_id", "coverage_item_id", "technique", "priority", "steps", "expected_result", "oracle_explanation", "automation_candidate", "status"]}
            editable={(row) => <EditableCell itemType="testCase" row={row} field="expected_result" multiline />}
          />
        )}

        {activeView === "models" && (
          <div className="viewStack">
            <section className="artifactGrid">
              <ArtifactCard title="Risk Scores" value={counts.risks} detail="Included in JSON and Excel workbook" />
              <ArtifactCard title="Test Cases" value={counts.tests} detail="Included in JSON, CSV, and Excel workbook" />
              <ArtifactCard title="Test Suites" value={counts.suites} detail="Included in JSON and Excel workbook" />
              <ArtifactCard title="Coverage Items" value={counts.coverage} detail="Included in JSON and Excel workbook" />
            </section>
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h3>FR 6.0 Structured Artifact Export</h3>
                  <p className="panelNote">Exports project-scoped requirements, risk scores, coverage items, strategies, test cases, optimized suites, prompt runs, and review records.</p>
                </div>
                <span>JSON, CSV, Excel</span>
              </div>
              <div className="exportActions">
                <button className="button" disabled={!projectId || busy !== ""} onClick={() => exportFile("json")}>
                  <Download size={16} /> Export All Artifacts JSON
                </button>
                <button className="button" disabled={!projectId || busy !== ""} onClick={() => exportFile("xlsx")}>
                  <FileSpreadsheet size={16} /> Export Workbook Excel
                </button>
                <button className="ghostButton" disabled={!projectId || busy !== ""} onClick={() => exportFile("csv")}>
                  <Download size={16} /> Export Test Cases CSV
                </button>
              </div>
            </section>
            <section className="twoCol">
              <div className="panel">
                <div className="panelHeader">
                  <h3>White-box Model</h3>
                  <span>State model and coverage criterion</span>
                </div>
                <pre>{JSON.stringify(snapshot.whiteboxModels, null, 2)}</pre>
              </div>
              <div className="panel">
                <div className="panelHeader">
                  <div>
                    <h3>FR 7.0 Suite Optimizer</h3>
                    <p className="panelNote">Shows original size, optimized size, reduction, retained coverage, and the selection reason for each suite.</p>
                  </div>
                  <span>Risk and coverage efficiency</span>
                </div>
                <SuiteOptimizer suites={snapshot.suiteVariants} />
              </div>
            </section>
          </div>
        )}

        {activeView === "logs" && (
          <section className="panel">
            <div className="panelHeader">
              <h3>Prompt Log</h3>
              <span>Model, stage, success, output summary</span>
            </div>
            <div className="log">
              {snapshot.promptRuns.length === 0 ? (
                <div className="emptyLog">No prompt runs yet.</div>
              ) : snapshot.promptRuns.slice(0, 24).map((run) => (
                <div className="logItem" key={text(run.id)}>
                  <strong>{text(run.stage)} / {text(run.model)}</strong>
                  <p>{text(run.output_summary)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ArtifactCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="artifactCard">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function SuiteOptimizer({ suites }: { suites: Row[] }) {
  if (suites.length === 0) {
    return <div className="emptyLog">Run Optimize after generating test cases.</div>;
  }

  return (
    <div className="suiteList">
      {suites.map((suite) => {
        const summary = (typeof suite.optimization_summary === "object" && suite.optimization_summary !== null
          ? suite.optimization_summary
          : {}) as Row;
        const requirements = rowList(summary.coveredRequirements);
        const techniques = rowList(summary.coveredTechniques);
        const highRisk = rowList(summary.coveredHighRiskItems);
        return (
          <article className="suiteCard" key={text(suite.id)}>
            <div className="suiteHead">
              <div>
                <h4>{text(suite.variant_name)}</h4>
                <p>{text(suite.description)}</p>
              </div>
              <span className="suiteReduction">{numberValue(summary.reductionRatio).toFixed(1)}% less</span>
            </div>
            <div className="suiteStats">
              <Metric label="Original cases" value={numberValue(summary.originalCaseCount)} />
              <Metric label="Optimized cases" value={numberValue(summary.optimizedCaseCount)} />
              <Metric label="Removed cases" value={numberValue(summary.removedCaseCount)} />
            </div>
            <div className="suiteCoverage">
              <CoverageGroup title="Requirements" rows={requirements} field="requirement_key" fallback="label" />
              <CoverageGroup title="Techniques" rows={techniques} field="technique" countField="test_count" />
              <CoverageGroup title="High Risk" rows={highRisk} field="requirement_key" fallback="label" />
            </div>
            <p className="selectionReason">{text(summary.selectionReason || suite.optimization_rationale)}</p>
          </article>
        );
      })}
    </div>
  );
}

function CoverageGroup({
  title,
  rows,
  field,
  fallback,
  countField
}: {
  title: string;
  rows: Row[];
  field: string;
  fallback?: string;
  countField?: string;
}) {
  return (
    <div className="coverageGroup">
      <strong>{title}</strong>
      <div className="chipList">
        {rows.length === 0 ? (
          <span className="mutedChip">None</span>
        ) : rows.slice(0, 10).map((row, index) => (
          <span className="coverageChip" key={`${title}-${index}`}>
            {text(row[field] || (fallback ? row[fallback] : ""))}
            {countField && row[countField] !== undefined ? ` x${text(row[countField])}` : ""}
          </span>
        ))}
        {rows.length > 10 && <span className="mutedChip">+{rows.length - 10} more</span>}
      </div>
    </div>
  );
}

function Action({
  onClick,
  label,
  icon,
  disabled
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="ghostButton" onClick={onClick} disabled={disabled}>
      {icon}
      {label}
    </button>
  );
}

function priorityClass(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (normalized === "high") return "badge high";
  if (normalized === "medium") return "badge medium";
  if (normalized === "low") return "badge low";
  if (normalized.includes("review")) return "badge review";
  return "";
}

function PanelTable({
  title,
  subtitle,
  rows,
  columns,
  editable
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  columns: string[];
  editable?: (row: Row) => React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h3>{title}</h3>
        <span>{subtitle} / {rows.length} rows</span>
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column}>{column}</th>)}
              {editable && <th>Human Review</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="emptyCell" colSpan={columns.length + (editable ? 1 : 0)}>No data yet.</td>
              </tr>
            ) : rows.map((row) => (
              <tr key={text(row.id)}>
                {columns.map((column) => {
                  const cls = column.includes("priority") || column.includes("status") ? priorityClass(row[column]) : "";
                  return (
                    <td key={column}>
                      {cls ? <span className={cls}>{text(row[column])}</span> : text(row[column])}
                    </td>
                  );
                })}
                {editable && <td>{editable(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
