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
  ListOrdered,
  Plus,
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
  executionEvidence: Row[];
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
  reviewRevisions: [],
  executionEvidence: []
};

const modelOptions = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" }
];

const pipelineSteps = [
  { path: "/requirements/structure", label: "Structuring requirements" },
  { path: "/risk/analyze", label: "Analyzing risk" },
  { path: "/coverage/generate", label: "Generating coverage" },
  { path: "/strategies/generate", label: "Generating strategies" },
  { path: "/test-cases/generate", label: "Generating test cases" },
  { path: "/white-box/model", label: "Generating white-box model" },
  { path: "/suite/optimize", label: "Optimizing suite" }
] as const;

type ViewId = "overview" | "requirements" | "analysis" | "cases" | "evidence" | "models" | "logs";

const workspaceViews: Array<{ id: ViewId; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Project setup, import, and AI pipeline" },
  { id: "requirements", label: "Requirements", description: "Structured requirements and review" },
  { id: "analysis", label: "Risk & Coverage", description: "Risk matrix, coverage items, and strategies" },
  { id: "cases", label: "Test Cases", description: "Generated cases and human review" },
  { id: "evidence", label: "Execution Evidence", description: "Target-app execution results and improvements" },
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

const PROJECT_ID_STORAGE_KEY = "autotest-active-project-id";

function pickRows(source: Record<string, unknown>, camel: string, snake: string) {
  return rowList(source[camel] ?? source[snake]);
}

function normalizeSnapshot(raw: unknown): Snapshot {
  if (!raw || typeof raw !== "object") return { ...emptySnapshot };

  const root = raw as Record<string, unknown>;
  const nestedProject = root.project;
  const hasSnapshotArrays =
    Array.isArray(root.requirements) ||
    Array.isArray(root.riskAssessments) ||
    Array.isArray(root.risk_assessments) ||
    Array.isArray(root.coverageItems) ||
    Array.isArray(root.coverage_items);

  const source =
    hasSnapshotArrays
      ? root
      : nestedProject && typeof nestedProject === "object" && !Array.isArray(nestedProject)
        ? (nestedProject as Record<string, unknown>)
        : root;

  const projectRow =
    typeof source.project === "object" && source.project !== null
      ? (source.project as Row)
      : typeof source.id !== "undefined" && !hasSnapshotArrays && !Array.isArray(source.requirements)
        ? (source as Row)
        : undefined;

  return {
    project: projectRow,
    requirements: pickRows(source, "requirements", "requirements"),
    riskAssessments: pickRows(source, "riskAssessments", "risk_assessments"),
    coverageItems: pickRows(source, "coverageItems", "coverage_items"),
    coverageStrategies: pickRows(source, "coverageStrategies", "coverage_strategies"),
    testCases: pickRows(source, "testCases", "test_cases"),
    whiteboxModels: pickRows(source, "whiteboxModels", "whitebox_models"),
    suiteVariants: pickRows(source, "suiteVariants", "suite_variants"),
    promptRuns: pickRows(source, "promptRuns", "prompt_runs"),
    reviewRevisions: pickRows(source, "reviewRevisions", "review_revisions"),
    executionEvidence: pickRows(source, "executionEvidence", "execution_evidence")
  };
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`${res.status} ${res.statusText}: ${body}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
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
  const [newCoverage, setNewCoverage] = useState({
    requirementId: "",
    coverageType: "evidence-based improvement",
    description: "",
    rationale: ""
  });
  const [newTestCase, setNewTestCase] = useState({
    requirementId: "",
    coverageItemId: "",
    testCaseKey: "",
    technique: "Evidence-based Test",
    priority: "High",
    steps: "",
    expectedResult: "",
    traceability: ""
  });
  const [evidenceDraft, setEvidenceDraft] = useState({
    testCaseId: "",
    targetModule: "newbee-mall",
    framework: "PyTest/requests smoke check",
    commandText: "python newbee-mall/tools/smoke_test_newbee.py",
    executionStatus: "PASS",
    expectedResult: "",
    actualResult: "",
    evidenceText: "",
    improvementAction: "",
    defectRef: ""
  });
  const [selectedModel, setSelectedModel] = useState(modelOptions[0].value);
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [sidebarWidth, setSidebarWidth] = useState(440);

  const counts = useMemo(
    () => ({
      requirements: snapshot.requirements.length,
      risks: snapshot.riskAssessments.length,
      coverage: snapshot.coverageItems.length,
      tests: snapshot.testCases.length,
      suites: snapshot.suiteVariants.length,
      evidence: snapshot.executionEvidence.length
    }),
    [snapshot]
  );
  const activeWorkspace = workspaceViews.find((view) => view.id === activeView) ?? workspaceViews[0];

  function applySnapshot(raw: unknown) {
    setSnapshot(normalizeSnapshot(raw));
  }

  function ensureImportedRequirements() {
    if (snapshot.requirements.length === 0) {
      throw new Error(
        "当前项目还没有需求。请先在 Requirement Ingestion 上传 xlsx/csv/txt 或粘贴文本，并点击 Import Requirements，再运行 AI 流水线。"
      );
    }
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "Failed to fetch") {
        setError(
          "无法连接后端 API。请确认后端已启动（http://localhost:28110/api/health），并使用 http://localhost:28111 或 http://127.0.0.1:28111 打开前端。"
        );
      } else {
        setError(message);
      }
    } finally {
      setBusy("");
    }
  }

  async function refresh(id = projectId) {
    if (!id) return;
    try {
      const data = await api(`/projects/${id}`);
      applySnapshot(data);
    } catch (err) {
      if ((err as Error & { status?: number }).status === 404) {
        window.localStorage.removeItem(PROJECT_ID_STORAGE_KEY);
        setProjectId(null);
        setSnapshot(emptySnapshot);
        setActiveView("overview");
        return;
      }
      throw err;
    }
  }

  async function createProject() {
    await run("Creating project", async () => {
      const data = await api("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, targetApp, description })
      });
      const snapshotData = normalizeSnapshot(data);
      const id = Number(snapshotData.project?.id ?? (data as Row).id);
      if (!Number.isFinite(id)) {
        throw new Error("创建项目失败：后端未返回有效的项目 id。");
      }
      setProjectId(id);
      applySnapshot(data);
    });
  }

  async function importRequirements() {
    if (!projectId) return;
    if (!file && !manualText.trim()) {
      setError("请先选择文件或在文本框中粘贴需求，再点击 Import Requirements。");
      return;
    }
    await run("Importing requirements", async () => {
      const form = new FormData();
      if (file) form.append("file", file);
      if (manualText.trim()) form.append("manualText", manualText);
      form.append("sourceType", file ? "file" : "manual");
      const data = await api(`/projects/${projectId}/requirements/import`, { method: "POST", body: form });
      applySnapshot(data);
      const imported = Number((data as Row).imported ?? 0);
      const requirementCount = normalizeSnapshot(data).requirements.length;
      if (imported === 0 || requirementCount === 0) {
        throw new Error("导入完成，但没有解析到有效需求行。请检查 xlsx 格式或手动输入内容。");
      }
    });
  }

  async function generate(path: string, label: string, nextView?: ViewId) {
    if (!projectId) return;
    await run(label, async () => {
      ensureImportedRequirements();
      const data = await api(`/projects/${projectId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel })
      });
      applySnapshot(data);
      if (nextView) setActiveView(nextView);
    });
  }

  async function runFullPipeline() {
    if (!projectId) return;
    await run("Full AI pipeline", async () => {
      ensureImportedRequirements();
      for (let i = 0; i < pipelineSteps.length; i++) {
        const step = pipelineSteps[i];
        setBusy(`${step.label} (${i + 1}/${pipelineSteps.length})`);
        const data = await api(`/projects/${projectId}${step.path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel })
        });
        applySnapshot(data);
      }
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

  async function createReviewItem(itemType: "coverage" | "testCase", payload: Record<string, string>) {
    if (!projectId) return;
    await run(`Adding ${itemType}`, async () => {
      const data = await api(`/projects/${projectId}/review-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, ...payload, note: "Evidence-based FR9 improvement" })
      });
      applySnapshot(data);
      if (itemType === "coverage") {
        setNewCoverage({ requirementId: "", coverageType: "evidence-based improvement", description: "", rationale: "" });
        setActiveView("analysis");
      } else {
        setNewTestCase({
          requirementId: "",
          coverageItemId: "",
          testCaseKey: "",
          technique: "Evidence-based Test",
          priority: "High",
          steps: "",
          expectedResult: "",
          traceability: ""
        });
        setActiveView("cases");
      }
    });
  }

  async function recordEvidence() {
    if (!projectId) return;
    await run("Recording execution evidence", async () => {
      const data = await api(`/projects/${projectId}/execution-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evidenceDraft)
      });
      applySnapshot(data);
      setEvidenceDraft((draft) => ({
        ...draft,
        testCaseId: "",
        expectedResult: "",
        actualResult: "",
        evidenceText: "",
        improvementAction: "",
        defectRef: ""
      }));
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

  function EditableFields({
    itemType,
    row,
    fields
  }: {
    itemType: string;
    row: Row;
    fields: Array<{ field: string; label: string; multiline?: boolean }>;
  }) {
    return (
      <div className="reviewFieldStack">
        {fields.map((item) => (
          <div className="reviewField" key={item.field}>
            <span>{item.label}</span>
            <EditableCell itemType={itemType} row={row} field={item.field} multiline={item.multiline} />
          </div>
        ))}
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

  useEffect(() => {
    const saved = window.localStorage.getItem(PROJECT_ID_STORAGE_KEY);
    if (!saved) return;
    const id = Number(saved);
    if (!Number.isFinite(id)) return;
    setProjectId(id);
    void refresh(id).catch((err) => {
      if ((err as Error & { status?: number }).status === 404) {
        window.localStorage.removeItem(PROJECT_ID_STORAGE_KEY);
        setProjectId(null);
        setSnapshot(emptySnapshot);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore last active project once on mount
  }, []);

  useEffect(() => {
    if (projectId) window.localStorage.setItem(PROJECT_ID_STORAGE_KEY, String(projectId));
  }, [projectId]);

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
            <Boxes size={16} /> Create New Project
          </button>
          <button className="ghostButton" onClick={() => refresh()} disabled={!projectId || busy !== ""}>
            <RefreshCw size={14} /> Reload Project Data
          </button>
          {projectId && (
            <p className="projectMeta">
              Active project #{projectId}
              {snapshot.project?.name ? ` · ${text(snapshot.project.name)}` : ""}
              {counts.requirements > 0 ? ` · ${counts.requirements} requirements` : " · no requirements imported"}
            </p>
          )}
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
              {projectId
                ? `Project #${projectId}${snapshot.project?.name ? ` (${text(snapshot.project.name)})` : ""} · ${counts.requirements} requirements · ${counts.tests} test cases / ${activeWorkspace.description}`
                : activeWorkspace.description}
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
              <Metric label="Execution Evidence" value={counts.evidence} />
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
                <div className="pipelineRunAll">
                  <button
                    className="button"
                    type="button"
                    disabled={!projectId || busy !== ""}
                    onClick={runFullPipeline}
                  >
                    <ListOrdered size={16} /> One Click Run All
                  </button>
                  <span className="pipelineRunAllHint">
                    Structure → Risk → Coverage → Strategies → Test Cases → White-box → Optimize
                  </span>
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
              editable={(row) => (
                <EditableFields
                  itemType="coverage"
                  row={row}
                  fields={[
                    { field: "coverage_type", label: "Type" },
                    { field: "description", label: "Coverage", multiline: true },
                    { field: "rationale", label: "Rationale", multiline: true }
                  ]}
                />
              )}
            />
            <PanelTable
              title="Strategy Map"
              subtitle="Selected testing techniques per coverage item, editable by the designer"
              rows={snapshot.coverageStrategies}
              columns={["id", "coverage_item_id", "techniques", "rationale", "status"]}
              editable={(row) => (
                <EditableFields
                  itemType="strategy"
                  row={row}
                  fields={[
                    { field: "techniques", label: "Techniques", multiline: true },
                    { field: "rationale", label: "Rationale", multiline: true }
                  ]}
                />
              )}
            />
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h3>Evidence-Based Coverage Improvement</h3>
                  <p className="panelNote">Add a new coverage item after reviewing execution results or discovered gaps.</p>
                </div>
                <span>FR9 improvement</span>
              </div>
              <div className="formGrid">
                <input className="input" placeholder="Requirement ID" value={newCoverage.requirementId} onChange={(e) => setNewCoverage((draft) => ({ ...draft, requirementId: e.target.value }))} />
                <input className="input" placeholder="Coverage type" value={newCoverage.coverageType} onChange={(e) => setNewCoverage((draft) => ({ ...draft, coverageType: e.target.value }))} />
                <textarea className="input" rows={3} placeholder="New coverage item" value={newCoverage.description} onChange={(e) => setNewCoverage((draft) => ({ ...draft, description: e.target.value }))} />
                <textarea className="input" rows={3} placeholder="Evidence or rationale" value={newCoverage.rationale} onChange={(e) => setNewCoverage((draft) => ({ ...draft, rationale: e.target.value }))} />
                <button className="button" disabled={!projectId || busy !== "" || !newCoverage.requirementId || !newCoverage.description} onClick={() => createReviewItem("coverage", newCoverage)}>
                  <Plus size={16} /> Add Coverage Item
                </button>
              </div>
            </section>
          </div>
        )}

        {activeView === "cases" && (
          <div className="viewStack">
            <PanelTable
              title="Test Case Studio"
              subtitle="Generated test cases with oracle explanations and traceability"
              rows={snapshot.testCases}
              columns={["id", "test_case_key", "requirement_id", "coverage_item_id", "technique", "priority", "steps", "expected_result", "oracle_explanation", "automation_candidate", "traceability", "status"]}
              editable={(row) => (
                <EditableFields
                  itemType="testCase"
                  row={row}
                  fields={[
                    { field: "technique", label: "Technique" },
                    { field: "steps", label: "Steps", multiline: true },
                    { field: "expected_result", label: "Oracle", multiline: true },
                    { field: "traceability", label: "Traceability", multiline: true }
                  ]}
                />
              )}
            />
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h3>Evidence-Based Test Case Improvement</h3>
                  <p className="panelNote">Create an extra test case when execution evidence reveals a missing scenario.</p>
                </div>
                <span>FR9 improvement</span>
              </div>
              <div className="formGrid">
                <input className="input" placeholder="Requirement ID" value={newTestCase.requirementId} onChange={(e) => setNewTestCase((draft) => ({ ...draft, requirementId: e.target.value }))} />
                <input className="input" placeholder="Coverage Item ID (optional)" value={newTestCase.coverageItemId} onChange={(e) => setNewTestCase((draft) => ({ ...draft, coverageItemId: e.target.value }))} />
                <input className="input" placeholder="Test Case Key (optional)" value={newTestCase.testCaseKey} onChange={(e) => setNewTestCase((draft) => ({ ...draft, testCaseKey: e.target.value }))} />
                <input className="input" placeholder="Technique" value={newTestCase.technique} onChange={(e) => setNewTestCase((draft) => ({ ...draft, technique: e.target.value }))} />
                <select className="select" value={newTestCase.priority} onChange={(e) => setNewTestCase((draft) => ({ ...draft, priority: e.target.value }))}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <textarea className="input wideField" rows={3} placeholder="Steps" value={newTestCase.steps} onChange={(e) => setNewTestCase((draft) => ({ ...draft, steps: e.target.value }))} />
                <textarea className="input wideField" rows={3} placeholder="Expected result / oracle" value={newTestCase.expectedResult} onChange={(e) => setNewTestCase((draft) => ({ ...draft, expectedResult: e.target.value }))} />
                <textarea className="input wideField" rows={2} placeholder="Traceability" value={newTestCase.traceability} onChange={(e) => setNewTestCase((draft) => ({ ...draft, traceability: e.target.value }))} />
                <button className="button" disabled={!projectId || busy !== "" || !newTestCase.requirementId || !newTestCase.steps || !newTestCase.expectedResult} onClick={() => createReviewItem("testCase", newTestCase)}>
                  <Plus size={16} /> Add Test Case
                </button>
              </div>
            </section>
          </div>
        )}

        {activeView === "evidence" && (
          <div className="viewStack">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <h3>Target Application Execution Evidence</h3>
                  <p className="panelNote">Record proof from running newbee-mall checks, then use failures or gaps to add coverage and test cases.</p>
                </div>
                <span>newbee-mall validation</span>
              </div>
              <div className="formGrid">
                <input className="input" placeholder="Test Case ID (optional)" value={evidenceDraft.testCaseId} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, testCaseId: e.target.value }))} />
                <input className="input" placeholder="Target module" value={evidenceDraft.targetModule} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, targetModule: e.target.value }))} />
                <input className="input" placeholder="Framework" value={evidenceDraft.framework} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, framework: e.target.value }))} />
                <select className="select" value={evidenceDraft.executionStatus} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, executionStatus: e.target.value }))}>
                  <option>PASS</option>
                  <option>FAIL</option>
                  <option>BLOCKED</option>
                  <option>NOT_RUN</option>
                </select>
                <input className="input wideField" placeholder="Execution command" value={evidenceDraft.commandText} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, commandText: e.target.value }))} />
                <textarea className="input wideField" rows={3} placeholder="Expected result" value={evidenceDraft.expectedResult} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, expectedResult: e.target.value }))} />
                <textarea className="input wideField" rows={3} placeholder="Actual result" value={evidenceDraft.actualResult} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, actualResult: e.target.value }))} />
                <textarea className="input wideField" rows={4} placeholder="Paste command output, screenshot note, or execution summary" value={evidenceDraft.evidenceText} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, evidenceText: e.target.value }))} />
                <input className="input" placeholder="Defect reference (optional)" value={evidenceDraft.defectRef} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, defectRef: e.target.value }))} />
                <textarea className="input wideField" rows={3} placeholder="Improvement action: add/modify coverage item, strategy, or test case" value={evidenceDraft.improvementAction} onChange={(e) => setEvidenceDraft((draft) => ({ ...draft, improvementAction: e.target.value }))} />
                <button className="button" disabled={!projectId || busy !== "" || !evidenceDraft.actualResult} onClick={recordEvidence}>
                  <Plus size={16} /> Record Evidence
                </button>
              </div>
            </section>
            <PanelTable
              title="Execution Evidence Ledger"
              subtitle="Target application validation records exported with the project artifacts"
              rows={snapshot.executionEvidence}
              columns={["id", "test_case_id", "target_module", "framework", "command_text", "execution_status", "expected_result", "actual_result", "evidence_text", "defect_ref", "improvement_action", "executed_at"]}
            />
          </div>
        )}

        {activeView === "models" && (
          <div className="viewStack">
            <section className="artifactGrid">
              <ArtifactCard title="Risk Scores" value={counts.risks} detail="Included in JSON and Excel workbook" />
              <ArtifactCard title="Test Cases" value={counts.tests} detail="Included in JSON, CSV, and Excel workbook" />
              <ArtifactCard title="Test Suites" value={counts.suites} detail="Included in JSON and Excel workbook" />
              <ArtifactCard title="Execution Evidence" value={counts.evidence} detail="Included in JSON and Excel workbook" />
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
