import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorPanel, LoadingPanel, PageHeader, Panel, ProgressBar } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useI18n } from "../lib/i18n";

const tooltipStyle = {
  background: "#fff",
  border: "1px solid rgba(167, 186, 182, 0.45)",
  borderRadius: 10,
  color: "#1c2422",
  boxShadow: "0 10px 24px rgba(21, 62, 58, 0.08)",
  fontSize: 12.5,
};

export function ProjectStats() {
  const { t } = useI18n();
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/overview") });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.get("/projects") });

  if (overviewQuery.isLoading || projectsQuery.isLoading) return <LoadingPanel />;
  if (overviewQuery.isError) {
    return <ErrorPanel message={errorMessage(overviewQuery.error)} retry={() => overviewQuery.refetch()} />;
  }

  const project = (projectsQuery.data ?? []).find((row) => String(row.id) === String(projectId));
  const ships = (overviewQuery.data?.ships ?? []).filter(
    (row) => String(row.project_id) === String(projectId),
  );
  const chartData = ships.map((ship) => ({
    name: ship.hull_no,
    rate: ship.completion_percent,
    pending: ship.before_sea_trial_open,
  }));

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}>
        <ArrowLeft size={14} />
        {t("projectStats.back")}
      </button>
      <PageHeader
        eyebrow={project?.code || "—"}
        title={t("projectStats.title")}
        description={t("projectStats.desc", { name: project?.name ?? "", n: ships.length })}
      />

      <section className="grid-half">
        <Panel title={t("projectStats.chart.rate")}>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64716e" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64716e" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${value}%`, t("projectStats.tooltip.rate")]} cursor={{ fill: "#f0fdfa" }} contentStyle={tooltipStyle} />
                <Bar dataKey="rate" fill="#0f766e" radius={[7, 7, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t("projectStats.chart.pending")}>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ece9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64716e" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 11, fill: "#64716e" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [value, t("projectStats.tooltip.pending")]} cursor={{ fill: "#fef3c7" }} contentStyle={tooltipStyle} />
                <Bar dataKey="pending" fill="#d97706" radius={[0, 7, 7, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      <Panel title={t("projectStats.table.title")} flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("project.col.ship")}</th>
                <th>{t("project.col.items")}</th>
                <th style={{ width: "30%" }}>{t("project.col.rate")}</th>
                <th style={{ textAlign: "right" }}>{t("project.col.beforeTrial")}</th>
                <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {ships.map((ship) => (
                <tr key={ship.ship_id}>
                  <td>
                    <div className="cell-main">{ship.hull_no}</div>
                    <div className="cell-sub">{ship.ship_name || t("common.none")}</div>
                  </td>
                  <td className="cell-sub">
                    {ship.completion_done} / {ship.completion_total}
                  </td>
                  <td>
                    <ProgressBar value={ship.completion_percent} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className={`count-chip ${ship.before_sea_trial_open > 0 ? "warn" : "ok"}`}>
                      {ship.before_sea_trial_open}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/projects/${projectId}/ships/${ship.ship_id}/itp`} className="link-button" style={{ fontSize: 13 }}>
                      {t("project.manageItp")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
