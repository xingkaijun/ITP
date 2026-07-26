import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Plus, Ship, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  LoadingPanel,
  ErrorPanel,
  Modal,
  PageHeader,
  ProgressBar,
} from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useToast } from "../lib/toast";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function Projects() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/overview") });

  const createMutation = useMutation({
    mutationFn: () => api.post("/projects", { name: form.name.trim(), description: form.description.trim() || null }),
    onSuccess: () => {
      toast.success(t("projects.toast.created"));
      setCreating(false);
      setForm({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      toast.success(t("projects.toast.deleted"));
      setDeleting(null);
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (projectsQuery.isLoading) return <LoadingPanel />;
  if (projectsQuery.isError) {
    return <ErrorPanel message={errorMessage(projectsQuery.error)} retry={() => projectsQuery.refetch()} />;
  }

  const projects = projectsQuery.data ?? [];
  const statsByProject = new Map(
    (overviewQuery.data?.projects ?? []).map((row) => [row.project_id, row]),
  );

  return (
    <>
      <PageHeader
        title={t("projects.title")}
        description={t("projects.desc")}
        actions={
          isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={15} />
              {t("projects.new")}
            </Button>
          )
        }
      />

      {projects.length === 0 ? (
        <div className="panel">
          <EmptyState title={t("projects.empty.title")} description={t("projects.empty.desc")} />
        </div>
      ) : (
        <section className="grid-cards">
          {projects.map((project) => {
            const stats = statsByProject.get(project.id) || {};
            const rate = stats.completion_total
              ? Math.round((stats.completion_done / stats.completion_total) * 1000) / 10
              : 0;
            return (
              <article key={project.id} className="card interactive project-card">
                <div className="proj-top">
                  <div style={{ minWidth: 0 }}>
                    {project.code ? <span className="code-tag">{project.code}</span> : <span className="cell-sub">—</span>}
                    <h3 className="brand">{project.name}</h3>
                  </div>
                  {isAdmin && (
                    <IconButton danger title={t("projects.delete.title")} onClick={() => setDeleting(project)}>
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </div>
                <p className="proj-desc">{project.description || t("projects.noDesc")}</p>

                <div className="proj-stats">
                  <div>
                    <div className="num">{stats.ship_count ?? 0}</div>
                    <div className="lbl">
                      <Ship size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                      {t("projects.ships")}
                    </div>
                  </div>
                  <div>
                    <div className="num">{stats.itp_item_count ?? 0}</div>
                    <div className="lbl">{t("projects.items")}</div>
                  </div>
                </div>

                <div>
                  <div className="cell-sub" style={{ marginBottom: 4 }}>{t("projects.completion")}</div>
                  <ProgressBar value={rate} />
                </div>

                <div className="proj-foot">
                  <span className="cell-sub" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CalendarDays size={13} />
                    {t("common.updated")} {formatDate(project.updated_at)}
                  </span>
                  <Link to={`/projects/${project.id}`} className="btn" style={{ minHeight: 32, fontSize: 12.5 }}>
                    {t("common.enter")}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("form.project.create")}
        footer={
          <>
            <Button variant="soft" onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button loading={createMutation.isPending} disabled={!form.name.trim()} onClick={() => createMutation.mutate()}>
              {t("common.create")}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12 }}>
          <Field label={t("form.project.name")}>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={t("form.project.desc.label")}>
            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <div className="alert-box info">
            <p style={{ margin: 0 }}>{t("form.project.hint")}</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t("projects.delete.title")}
        description={t("projects.delete.desc", { name: deleting?.name ?? "" })}
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  );
}
