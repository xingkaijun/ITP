import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  ListChecks,
  RefreshCw,
  Ship,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  EmptyState,
  ErrorPanel,
  IconButton,
  LoadingPanel,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
} from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useToast } from "../lib/toast";

function SyncPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingOpen, setPendingOpen] = useState(false);

  const pendingQuery = useQuery({
    queryKey: ["sync-pending"],
    queryFn: () => api.get("/sync/nbins/pending"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/sync/nbins"),
    onSuccess: (result) => {
      toast.success(
        t("sync.result", {
          pc: (result?.projects_created ?? 0) + (result?.projects_linked ?? 0),
          sc: result?.ships_created ?? 0,
          ea: result?.events_applied ?? 0,
          ep: result?.events_pending ?? 0,
        }),
      );
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => api.delete(`/sync/nbins/pending/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync-pending"] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pending = pendingQuery.data ?? [];

  return (
    <Panel title={t("sync.title")} description={t("sync.desc")}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
          <RefreshCw size={15} />
          {syncMutation.isPending ? t("sync.running") : t("sync.run")}
        </Button>
        {pending.length > 0 ? (
          <button type="button" className="filter-toggle on" onClick={() => setPendingOpen(true)}>
            <TriangleAlert size={14} />
            {t("sync.pending.count", { n: pending.length })}
          </button>
        ) : (
          <span className="cell-sub">{t("sync.pending.empty")}</span>
        )}
      </div>

      <Modal
        open={pendingOpen}
        onClose={() => setPendingOpen(false)}
        title={t("sync.pending.title")}
        description={t("sync.pending.desc")}
        wide
      >
        {pending.length === 0 ? (
          <p className="cell-sub">{t("sync.pending.empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Event</th>
                  <th>{t("sync.pending.reason")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => {
                  const payload = row.payload || {};
                  return (
                    <tr key={row.id}>
                      <td className="mono">{row.outbox_id}</td>
                      <td>
                        <div className="cell-main mono" style={{ fontSize: 12.5 }}>
                          {payload.projectCode} / {payload.hullNumber} / {payload.itpCode}
                        </div>
                        <div className="cell-sub">→ {payload.itpStatus}</div>
                      </td>
                      <td className="cell-sub" style={{ maxWidth: 320 }}>{row.reason}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="soft"
                          style={{ minHeight: 30, fontSize: 12 }}
                          loading={dismissMutation.isPending}
                          onClick={() => dismissMutation.mutate(row.id)}
                        >
                          {t("sync.pending.dismiss")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </Panel>
  );
}

export function Dashboard() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const query = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/overview") });

  if (query.isLoading) return <LoadingPanel />;
  if (query.isError || !query.data) {
    return <ErrorPanel message={errorMessage(query.error)} retry={() => query.refetch()} />;
  }

  const data = query.data;
  const ships = [...(data.ships || [])].sort((a, b) => {
    if (b.before_sea_trial_open !== a.before_sea_trial_open) {
      return b.before_sea_trial_open - a.before_sea_trial_open;
    }
    return a.completion_percent - b.completion_percent;
  });
  const totalDone = (data.projects || []).reduce((sum, p) => sum + p.completion_done, 0);
  const totalSlots = (data.projects || []).reduce((sum, p) => sum + p.completion_total, 0);
  const overallRate = totalSlots ? Math.round((totalDone / totalSlots) * 1000) / 10 : 0;

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.desc")}
      />

      <section className="grid-metrics">
        <MetricCard icon={FolderKanban} label={t("dashboard.stat.projects")} value={data.project_count} />
        <MetricCard icon={Ship} label={t("dashboard.stat.ships")} value={data.ship_count} />
        <MetricCard icon={ListChecks} label={t("dashboard.stat.items")} value={data.itp_item_count} />
        <MetricCard icon={CheckCircle2} label={t("dashboard.stat.rate")} value={`${overallRate}%`} />
      </section>

      <section className="grid-split">
        <Panel title={t("dashboard.attention.title")} description={t("dashboard.attention.desc")} flush>
          {ships.length === 0 ? (
            <EmptyState title={t("dashboard.empty.ships")} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("dashboard.col.ship")}</th>
                    <th>{t("dashboard.col.project")}</th>
                    <th style={{ width: "26%" }}>{t("dashboard.col.rate")}</th>
                    <th style={{ textAlign: "right" }}>{t("dashboard.col.beforeTrial")}</th>
                    <th style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {ships.map((ship) => (
                    <tr key={ship.ship_id}>
                      <td>
                        <div className="cell-main">{ship.hull_no}</div>
                        <div className="cell-sub">{ship.ship_name || t("common.none")}</div>
                      </td>
                      <td className="cell-sub">{ship.project_name}</td>
                      <td>
                        <ProgressBar value={ship.completion_percent} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`count-chip ${ship.before_sea_trial_open > 0 ? "warn" : "ok"}`}>
                          {ship.before_sea_trial_open}
                        </span>
                      </td>
                      <td>
                        <Link to={`/projects/${ship.project_id}/ships/${ship.ship_id}/itp`} title={t("dashboard.openItp")}>
                          <IconButton title={t("dashboard.openItp")}>
                            <ArrowRight size={15} />
                          </IconButton>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="stack">
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              <ClipboardList size={14} style={{ color: "var(--accent)" }} />
              {t("dashboard.overall.title")}
            </div>
            <div className="big-number" style={{ marginTop: 14 }}>
              {overallRate}
              <span className="unit">%</span>
            </div>
            <p className="cell-sub" style={{ margin: "4px 0 14px" }}>
              {t("dashboard.overall.done", { completed: totalDone, total: totalSlots })}
            </p>
            <ProgressBar value={overallRate} showLabel={false} />
            <p className="cell-sub" style={{ marginTop: 16, borderTop: "1px solid #edf2f7", paddingTop: 12 }}>
              {t("dashboard.overall.note")}
            </p>
            <p className="cell-sub" style={{ marginTop: 6 }}>{t("dashboard.history.hint", { n: data.history_count })}</p>
          </div>
          {isAdmin && <SyncPanel />}
        </div>
      </section>
    </>
  );
}
