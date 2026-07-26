import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, ListChecks } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ErrorPanel,
  LoadingPanel,
  MetricCard,
  PageHeader,
  Panel,
  ProgressBar,
} from "../components/ui";
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

function naturalCodeKey(code) {
  return String(code || "")
    .split(".")
    .map((part) => (Number.isNaN(Number(part)) ? part : Number(part).toString().padStart(6, "0")))
    .join(".");
}

function flattenTree(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) flattenTree(node.children, out);
  }
  return out;
}

export function ShipStats() {
  const { t } = useI18n();
  const { projectId = "", shipId = "" } = useParams();
  const navigate = useNavigate();

  const treeQuery = useQuery({
    queryKey: ["tree", projectId, false],
    queryFn: () => api.get(`/projects/${projectId}/tree?include_inactive=false`),
    enabled: Boolean(projectId),
  });
  const shipsQuery = useQuery({
    queryKey: ["ships", projectId],
    queryFn: () => api.get(`/projects/${projectId}/ships`),
    enabled: Boolean(projectId),
  });
  const progressQuery = useQuery({
    queryKey: ["progress", shipId],
    queryFn: () => api.get(`/ships/${shipId}/progress`),
    enabled: Boolean(shipId),
  });

  const stats = useMemo(() => {
    const tree = treeQuery.data ?? [];
    const flat = flattenTree(tree);
    const byId = new Map(flat.map((item) => [item.id, item]));
    const progressByItem = new Map((progressQuery.data ?? []).map((row) => [row.item_id, row]));
    const leaves = flat.filter((item) => item.is_inspection && item.active !== false);

    const statusOf = (item) => progressByItem.get(item.id)?.status || "not_started";
    const counts = { not_started: 0, in_progress: 0, done: 0, not_applicable: 0 };
    for (const leaf of leaves) counts[statusOf(leaf)] += 1;

    const summarize = (subset) => {
      const total = subset.length;
      const done = subset.filter((leaf) => statusOf(leaf) === "done").length;
      const na = subset.filter((leaf) => statusOf(leaf) === "not_applicable").length;
      const effective = Math.max(total - na, 0);
      return {
        total,
        done,
        na,
        effective,
        rate: effective ? Math.round((done / effective) * 1000) / 10 : 0,
      };
    };

    const ancestorAt = (leaf, level) => {
      let node = leaf;
      while (node && node.level > level) node = byId.get(node.parent_id);
      return node && node.level === level ? node : null;
    };

    const groupBy = (level) => {
      const groups = new Map();
      for (const leaf of leaves) {
        const ancestor = ancestorAt(leaf, level);
        if (!ancestor) continue;
        if (!groups.has(ancestor.code)) groups.set(ancestor.code, { node: ancestor, leaves: [] });
        groups.get(ancestor.code).leaves.push(leaf);
      }
      return [...groups.values()]
        .map(({ node, leaves: groupLeaves }) => {
          const summary = summarize(groupLeaves);
          const before = groupLeaves.filter((leaf) => leaf.before_sea_trial);
          return {
            code: node.code,
            title: node.title_zh || node.title_en,
            ...summary,
            beforeTotal: before.length,
            beforeDone: before.filter((leaf) => statusOf(leaf) === "done").length,
          };
        })
        .sort((a, b) => naturalCodeKey(a.code).localeCompare(naturalCodeKey(b.code)));
    };

    return {
      leaves,
      counts,
      overall: summarize(leaves),
      before: summarize(leaves.filter((leaf) => leaf.before_sea_trial)),
      level1: groupBy(1),
      level2: groupBy(2),
    };
  }, [treeQuery.data, progressQuery.data]);

  if (treeQuery.isLoading || progressQuery.isLoading || shipsQuery.isLoading) return <LoadingPanel />;
  if (treeQuery.isError) return <ErrorPanel message={errorMessage(treeQuery.error)} retry={() => treeQuery.refetch()} />;
  if (progressQuery.isError) {
    return <ErrorPanel message={errorMessage(progressQuery.error)} retry={() => progressQuery.refetch()} />;
  }

  const ship = (shipsQuery.data ?? []).find((row) => String(row.id) === String(shipId));
  const hull = ship?.hull_no ?? `#${shipId}`;

  const CategoryChart = ({ title, rows }) => (
    <Panel title={title}>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.slice(0, 15)} margin={{ top: 8, right: 10, left: -18, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2ece9" vertical={false} />
            <XAxis
              dataKey="code"
              tick={{ fontSize: 10, fill: "#64716e" }}
              angle={rows.length > 7 ? -30 : 0}
              textAnchor={rows.length > 7 ? "end" : "middle"}
              height={rows.length > 7 ? 50 : 26}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64716e" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${value}%`, t("projectStats.tooltip.rate")]}
              cursor={{ fill: "#f0fdfa" }}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="rate" fill="#14b8a6" radius={[7, 7, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}/ships/${shipId}/itp`)}>
        <ArrowLeft size={14} />
        {t("shipStats.back")}
      </button>
      <PageHeader
        eyebrow={hull}
        title={t("shipStats.title", { hull })}
        description={t("shipStats.desc")}
      />

      <section className="grid-half">
        <div className="card" style={{ padding: 20 }}>
          <div className="cell-sub" style={{ fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11 }}>
            {t("shipStats.overall")}
          </div>
          <div className="big-number" style={{ marginTop: 10 }}>
            {stats.overall.rate}
            <span className="unit">%</span>
          </div>
          <p className="cell-sub" style={{ margin: "4px 0 12px" }}>
            {t("shipStats.done.of", { completed: stats.overall.done, total: stats.overall.effective })}
          </p>
          <ProgressBar value={stats.overall.rate} showLabel={false} />
        </div>
        <div className="card" style={{ padding: 20, borderColor: "rgba(217, 119, 6, 0.3)" }}>
          <div className="cell-sub" style={{ fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11 }}>
            {t("shipStats.before")}
          </div>
          <div className="big-number" style={{ marginTop: 10 }}>
            {stats.before.rate}
            <span className="unit">%</span>
          </div>
          <p className="cell-sub" style={{ margin: "4px 0 12px" }}>
            {t("shipStats.done.of", { completed: stats.before.done, total: stats.before.effective })}
          </p>
          <ProgressBar value={stats.before.rate} showLabel={false} />
        </div>
      </section>

      <section className="grid-metrics">
        <MetricCard icon={CircleDashed} label={t("status.not_started")} value={stats.counts.not_started} />
        <MetricCard icon={Clock3} label={t("status.in_progress")} value={stats.counts.in_progress} />
        <MetricCard icon={CheckCircle2} label={t("status.done")} value={stats.counts.done} />
        <MetricCard icon={ListChecks} label={t("status.not_applicable")} value={stats.counts.not_applicable} />
      </section>

      <section className="grid-half">
        <CategoryChart title={t("shipStats.level1")} rows={stats.level1} />
        <CategoryChart title={t("shipStats.level2")} rows={stats.level2} />
      </section>

      <Panel title={t("shipStats.table.title")} flush>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("shipStats.col.code")}</th>
                <th>{t("shipStats.col.total")}</th>
                <th>{t("shipStats.col.done")}</th>
                <th>{t("shipStats.col.na")}</th>
                <th style={{ width: "26%" }}>{t("shipStats.col.rate")}</th>
                <th style={{ textAlign: "right" }}>{t("shipStats.col.before")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.level2.map((row) => (
                <tr key={row.code}>
                  <td>
                    <span className="code-tag">{row.code}</span>
                    <span style={{ marginLeft: 8, fontSize: 13 }}>{row.title}</span>
                  </td>
                  <td className="cell-sub">{row.total}</td>
                  <td style={{ color: "#166534", fontWeight: 600 }}>{row.done}</td>
                  <td style={{ color: "#92400e" }}>{row.na}</td>
                  <td>
                    <ProgressBar value={row.rate} />
                  </td>
                  <td className="cell-sub" style={{ textAlign: "right" }}>
                    {row.beforeDone} / {row.beforeTotal}
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
