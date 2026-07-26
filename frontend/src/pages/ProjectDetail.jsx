import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Download,
  FileSpreadsheet,
  History,
  ListChecks,
  Pencil,
  Plus,
  Ship,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorPanel,
  Field,
  IconButton,
  LoadingPanel,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
} from "../components/ui";
import { api, downloadFile, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useToast } from "../lib/toast";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ShipFormModal({ open, ship, projectId, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ hull_no: "", name: "" });

  useEffect(() => {
    setForm(ship ? { hull_no: ship.hull_no, name: ship.name || "" } : { hull_no: "", name: "" });
  }, [ship, open]);

  const saveMutation = useMutation({
    mutationFn: () =>
      ship
        ? api.put(`/ships/${ship.id}`, { hull_no: form.hull_no.trim(), name: form.name.trim() || null })
        : api.post("/ships", { project_id: Number(projectId), hull_no: form.hull_no.trim(), name: form.name.trim() || null }),
    onSuccess: () => {
      toast.success(ship ? t("project.toast.ship.updated") : t("project.toast.ship.created"));
      onClose();
      queryClient.invalidateQueries({ queryKey: ["ships", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ship ? t("form.ship.edit") : t("form.ship.create")}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>{t("common.cancel")}</Button>
          <Button loading={saveMutation.isPending} disabled={!form.hull_no.trim()} onClick={() => saveMutation.mutate()}>
            {ship ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t("form.ship.hull")}>
          <input value={form.hull_no} onChange={(event) => setForm({ ...form, hull_no: event.target.value })} />
        </Field>
        <Field label={t("form.ship.name")}>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ImportModal({ open, onClose, projectId }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("partial");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setMode("partial");
    }
  }, [open]);

  const previewMutation = useMutation({
    mutationFn: () => {
      const data = new FormData();
      data.append("file", file);
      return api.upload("/import/preview", data);
    },
    onSuccess: (result) => setPreview(result),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      const data = new FormData();
      data.append("file", file);
      return api.upload(`/import/apply?mode=${mode}`, data);
    },
    onSuccess: () => {
      toast.success(t("import.toast.done"));
      onClose();
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("import.title")}
      description={t("import.desc")}
      wide
      footer={
        <>
          <Button variant="soft" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            loading={applyMutation.isPending}
            disabled={!preview}
            onClick={() => applyMutation.mutate()}
          >
            <Upload size={15} />
            {t("import.apply")}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ flex: 1, minWidth: 220 }}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <Button
            variant="soft"
            disabled={!file}
            loading={previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            <FileSpreadsheet size={15} />
            {previewMutation.isPending ? t("import.parsing") : t("import.preview")}
          </Button>
        </div>

        {preview && (
          <>
            <div className="grid-metrics" style={{ gap: 10 }}>
              {[
                [t("import.rows"), preview.rows],
                [t("import.creates"), preview.creates?.length ?? 0],
                [t("import.updates"), preview.updates?.length ?? 0],
                [t("import.missing"), preview.missing_from_upload?.length ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="card" style={{ padding: "10px 14px" }}>
                  <div className="cell-sub">{label}</div>
                  <div style={{ fontFamily: "Space Grotesk, Inter, sans-serif", fontSize: 20, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <label className="checkbox-row">
                <input type="radio" name="import-mode" checked={mode === "partial"} onChange={() => setMode("partial")} />
                <span>{t("import.mode.partial")}</span>
              </label>
              <label className="checkbox-row">
                <input type="radio" name="import-mode" checked={mode === "global"} onChange={() => setMode("global")} />
                <span>{t("import.mode.global")}</span>
              </label>
              {mode === "global" && (
                <div className="alert-box warning">
                  <p style={{ margin: 0 }}>{t("import.mode.global.warn")}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function HistoryPanel({ projectId }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rollingBack, setRollingBack] = useState(null);

  const historyQuery = useQuery({
    queryKey: ["history", projectId],
    queryFn: () => api.get(`/history?project_id=${projectId}&limit=60`),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id) => api.post(`/history/${id}/rollback`),
    onSuccess: () => {
      toast.success(t("project.toast.rollback"));
      setRollingBack(null);
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = historyQuery.data ?? [];

  return (
    <Panel title={t("project.history.title")} description={t("project.history.desc")} flush>
      {historyQuery.isLoading ? (
        <div className="loading-panel" style={{ minHeight: 120 }}>{t("common.loading")}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("project.history.empty")} />
      ) : (
        <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table className="data">
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ width: "62%" }}>
                    <div style={{ fontSize: 13 }}>{row.summary}</div>
                    <div className="cell-sub">
                      {row.actor} · {formatDateTime(row.created_at)}
                    </div>
                  </td>
                  <td className="cell-sub mono" style={{ fontSize: 11.5 }}>{row.action}</td>
                  <td style={{ textAlign: "right" }}>
                    {isAdmin && row.before_json && (
                      <IconButton title={t("project.history.rollback")} onClick={() => setRollingBack(row)}>
                        <Undo2 size={14} />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(rollingBack)}
        title={t("project.history.rollback.title")}
        description={t("project.history.rollback.desc", { summary: rollingBack?.summary ?? "" })}
        confirmLabel={t("project.history.rollback.confirm")}
        loading={rollbackMutation.isPending}
        onClose={() => setRollingBack(null)}
        onConfirm={() => rollingBack && rollbackMutation.mutate(rollingBack.id)}
      />
    </Panel>
  );
}

export function ProjectDetail() {
  const { t } = useI18n();
  const { projectId = "" } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shipForm, setShipForm] = useState(undefined); // undefined=closed, null=create, object=edit
  const [deletingShip, setDeletingShip] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
  const shipsQuery = useQuery({
    queryKey: ["ships", projectId],
    queryFn: () => api.get(`/projects/${projectId}/ships`),
    enabled: Boolean(projectId),
  });
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/overview") });

  const deleteShipMutation = useMutation({
    mutationFn: (id) => api.delete(`/ships/${id}`),
    onSuccess: () => {
      toast.success(t("project.toast.ship.deleted"));
      setDeletingShip(null);
      queryClient.invalidateQueries({ queryKey: ["ships", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (projectsQuery.isLoading || shipsQuery.isLoading) return <LoadingPanel />;
  if (projectsQuery.isError) {
    return <ErrorPanel message={errorMessage(projectsQuery.error)} retry={() => projectsQuery.refetch()} />;
  }

  const project = (projectsQuery.data ?? []).find((row) => String(row.id) === String(projectId));
  if (!project) {
    return <ErrorPanel message={`Project ${projectId} not found`} retry={() => projectsQuery.refetch()} />;
  }

  const ships = shipsQuery.data ?? [];
  const overviewShips = new Map(
    (overviewQuery.data?.ships ?? [])
      .filter((row) => String(row.project_id) === String(projectId))
      .map((row) => [row.ship_id, row]),
  );
  const projectStats = (overviewQuery.data?.projects ?? []).find(
    (row) => String(row.project_id) === String(projectId),
  ) || {};
  const projectRate = projectStats.completion_total
    ? Math.round((projectStats.completion_done / projectStats.completion_total) * 1000) / 10
    : 0;

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate("/projects")}>
        <ArrowLeft size={14} />
        {t("project.back")}
      </button>

      <PageHeader
        eyebrow={project.code || "—"}
        title={project.name}
        description={project.description || undefined}
        actions={
          <>
            {isAdmin && (
              <>
                <Button variant="soft" onClick={() => setImportOpen(true)}>
                  <Upload size={15} />
                  {t("project.import")}
                </Button>
                <Button
                  variant="soft"
                  onClick={() =>
                    downloadFile(`/projects/${projectId}/export`, `itp-${project.code || projectId}.xlsx`).catch(
                      (error) => toast.error(errorMessage(error)),
                    )
                  }
                >
                  <Download size={15} />
                  {t("project.export")}
                </Button>
              </>
            )}
            <Link to={`/projects/${projectId}/stats`} className="btn soft-button">
              <BarChart3 size={15} />
              {t("project.stats")}
            </Link>
            {isAdmin && (
              <Button onClick={() => setShipForm(null)}>
                <Plus size={15} />
                {t("project.addShip")}
              </Button>
            )}
          </>
        }
      />

      <section className="grid-metrics">
        <MetricCard icon={Ship} label={t("project.stat.ships")} value={projectStats.ship_count ?? ships.length} />
        <MetricCard icon={ListChecks} label={t("project.stat.items")} value={projectStats.itp_item_count ?? 0} />
        <MetricCard
          icon={BarChart3}
          label={t("project.stat.rate")}
          value={`${projectRate}%`}
          hint={`${projectStats.completion_done ?? 0} / ${projectStats.completion_total ?? 0}`}
        />
        <MetricCard icon={History} label={t("project.stat.history")} value={overviewQuery.data?.history_count ?? "—"} />
      </section>

      <Panel title={t("project.ships.title")} description={t("project.ships.desc")} flush>
        {ships.length === 0 ? (
          <EmptyState
            title={t("project.empty.ships")}
            description={t("project.empty.ships.desc")}
            action={
              isAdmin && (
                <Button onClick={() => setShipForm(null)}>
                  <Plus size={15} />
                  {t("project.addShip")}
                </Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("project.col.ship")}</th>
                  <th>{t("project.col.items")}</th>
                  <th style={{ width: "26%" }}>{t("project.col.rate")}</th>
                  <th style={{ textAlign: "right" }}>{t("project.col.beforeTrial")}</th>
                  <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {ships.map((ship) => {
                  const stats = overviewShips.get(ship.id) || {};
                  return (
                    <tr key={ship.id}>
                      <td>
                        <div className="cell-main">{ship.hull_no}</div>
                        <div className="cell-sub">{ship.name || t("common.none")}</div>
                      </td>
                      <td className="cell-sub">
                        {stats.completion_done ?? 0} / {stats.completion_total ?? 0}
                      </td>
                      <td>
                        <ProgressBar value={stats.completion_percent ?? 0} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`count-chip ${(stats.before_sea_trial_open ?? 0) > 0 ? "warn" : "ok"}`}>
                          {stats.before_sea_trial_open ?? 0}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, alignItems: "center" }}>
                          {isAdmin && (
                            <>
                              <IconButton title={t("form.ship.edit")} onClick={() => setShipForm(ship)}>
                                <Pencil size={14} />
                              </IconButton>
                              <IconButton danger title={t("project.delete.ship.title")} onClick={() => setDeletingShip(ship)}>
                                <Trash2 size={14} />
                              </IconButton>
                            </>
                          )}
                          <Link to={`/projects/${projectId}/ships/${ship.id}/itp`} className="btn" style={{ minHeight: 30, fontSize: 12 }}>
                            {t("project.manageItp")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <HistoryPanel projectId={projectId} />

      <ShipFormModal
        open={shipForm !== undefined}
        ship={shipForm}
        projectId={projectId}
        onClose={() => setShipForm(undefined)}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} projectId={projectId} />
      <ConfirmDialog
        open={Boolean(deletingShip)}
        title={t("project.delete.ship.title")}
        description={t("project.delete.ship.desc", { name: deletingShip ? `${deletingShip.hull_no} ${deletingShip.name || ""}`.trim() : "" })}
        loading={deleteShipMutation.isPending}
        onClose={() => setDeletingShip(null)}
        onConfirm={() => deletingShip && deleteShipMutation.mutate(deletingShip.id)}
      />
    </>
  );
}
