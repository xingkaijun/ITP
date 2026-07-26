import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardPlus,
  Download,
  Eye,
  FileText,
  Flag,
  FolderTree,
  Pencil,
  Power,
  Search,
  StickyNote,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorPanel,
  Field,
  IconButton,
  LoadingPanel,
  Modal,
  PageHeader,
  StatusSelect,
  STATUSES,
} from "../components/ui";
import { api, downloadFile, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useToast } from "../lib/toast";

function flattenTree(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) flattenTree(node.children, out);
  }
  return out;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ItemEditorModal({ open, item, allItems, projectId, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const empty = { parent_code: "", code: "", title_zh: "", title_en: "", is_inspection: false, sort_order: 0 };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(
      item
        ? {
            parent_code: item.parent_code || "",
            code: item.code,
            title_zh: item.title_zh || "",
            title_en: item.title_en || "",
            is_inspection: Boolean(item.is_inspection),
            sort_order: item.sort_order ?? 0,
          }
        : empty,
    );
  }, [item, open]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        parent_code: form.parent_code || null,
        code: form.code.trim(),
        title_zh: form.title_zh.trim() || null,
        title_en: form.title_en.trim(),
        is_inspection: form.is_inspection,
        sort_order: Number(form.sort_order) || 0,
      };
      return item
        ? api.put(`/itp-items/${item.id}`, payload)
        : api.post("/itp-items", { ...payload, project_id: Number(projectId) });
    },
    onSuccess: () => {
      toast.success(item ? t("ship.item.toast.updated") : t("ship.item.toast.created"));
      onClose();
      queryClient.invalidateQueries({ queryKey: ["tree", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? t("ship.item.edit") : t("ship.item.add")}
      description={t("ship.item.editor.desc")}
      wide
      footer={
        <>
          <Button variant="soft" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            loading={saveMutation.isPending}
            disabled={!form.code.trim() || !form.title_en.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {item ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <div className="form-grid">
          <Field label={t("ship.item.parent")}>
            <select value={form.parent_code} onChange={(event) => setForm({ ...form, parent_code: event.target.value })}>
              <option value="">{t("ship.item.parent.none")}</option>
              {allItems
                .filter((candidate) => candidate.id !== item?.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.code}>
                    {candidate.code} · {candidate.title_zh || candidate.title_en}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("ship.item.code")}>
            <input className="mono" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label={t("ship.item.titleZh")}>
            <input value={form.title_zh} onChange={(event) => setForm({ ...form, title_zh: event.target.value })} />
          </Field>
          <Field label={t("ship.item.titleEn")}>
            <input value={form.title_en} onChange={(event) => setForm({ ...form, title_en: event.target.value })} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label={t("ship.item.sort")}>
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            />
          </Field>
          <label className="checkbox-row" style={{ alignSelf: "end" }}>
            <input
              type="checkbox"
              checked={form.is_inspection}
              onChange={(event) => setForm({ ...form, is_inspection: event.target.checked })}
            />
            <span>{t("ship.item.isInspection")}</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

export function ShipItp() {
  const { t } = useI18n();
  const { projectId = "", shipId = "" } = useParams();
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recordsInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [beforeOnly, setBeforeOnly] = useState(false);
  const [view, setView] = useState("tree");
  const [showInactive, setShowInactive] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("done");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editing, setEditing] = useState(undefined); // undefined closed / null create / item edit
  const [deleting, setDeleting] = useState(null);
  const [notesRow, setNotesRow] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");

  const treeQuery = useQuery({
    queryKey: ["tree", projectId, showInactive],
    queryFn: () => api.get(`/projects/${projectId}/tree?include_inactive=${showInactive ? "true" : "false"}`),
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

  const refreshProgress = () => {
    queryClient.invalidateQueries({ queryKey: ["progress", shipId] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ itemId, status, notes, expectedRevision }) =>
      api.put(`/ships/${shipId}/progress/${itemId}`, {
        status,
        notes: notes ?? null,
        updated_by: user,
        expected_revision: expectedRevision,
      }),
    onSuccess: () => {
      toast.success(t("ship.toast.status"));
      refreshProgress();
    },
    onError: (error) => {
      if (error?.status === 409) {
        toast.error(t("ship.toast.conflict"));
        refreshProgress();
      } else {
        toast.error(errorMessage(error));
      }
    },
  });

  const flagMutation = useMutation({
    mutationFn: (itemId) => api.put(`/itp-items/${itemId}/before-sea-trial`),
    onSuccess: () => {
      toast.success(t("ship.item.toast.flag"));
      queryClient.invalidateQueries({ queryKey: ["tree", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const activeMutation = useMutation({
    mutationFn: ({ itemId, active }) => api.put(`/itp-items/${itemId}/active?active=${active}`),
    onSuccess: () => {
      toast.success(t("ship.item.toast.active"));
      queryClient.invalidateQueries({ queryKey: ["tree", projectId] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId) => api.delete(`/itp-items/${itemId}`),
    onSuccess: () => {
      toast.success(t("ship.item.toast.deleted"));
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["tree", projectId] });
      refreshProgress();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const importRecordsMutation = useMutation({
    mutationFn: (file) => {
      const data = new FormData();
      data.append("file", file);
      return api.upload(`/ships/${shipId}/records/import`, data);
    },
    onSuccess: () => {
      toast.success(t("ship.toast.records.imported"));
      refreshProgress();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const tree = treeQuery.data ?? [];
  const progressRows = progressQuery.data ?? [];

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const byId = useMemo(() => new Map(flat.map((item) => [item.id, item])), [flat]);
  const progressByItem = useMemo(
    () => new Map(progressRows.map((row) => [row.item_id, row])),
    [progressRows],
  );

  const orderedTreeRows = useMemo(() => {
    const result = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children?.length && !collapsed.has(node.id)) walk(node.children);
      }
    };
    walk(tree);
    return result;
  }, [tree, collapsed]);

  const filterActive = Boolean(search.trim() || statusFilter || beforeOnly);

  const filtered = useMemo(() => {
    const source = view === "tree" && !filterActive ? orderedTreeRows : flat;
    const term = search.trim().toLowerCase();
    return source.filter((item) => {
      const progress = progressByItem.get(item.id);
      const status = progress?.status || "not_started";
      if (statusFilter && (!item.is_inspection || status !== statusFilter)) return false;
      if (beforeOnly && !item.before_sea_trial) return false;
      if (!term) return true;
      const haystack = [item.code, item.title_zh, item.title_en, progress?.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [view, filterActive, orderedTreeRows, flat, search, statusFilter, beforeOnly, progressByItem]);

  const selectableRows = filtered.filter((item) => item.is_inspection && item.active !== false);
  const allSelected = selectableRows.length > 0 && selectableRows.every((item) => selected.has(item.id));

  const toggleSelected = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function applyBulk() {
    setBulkBusy(true);
    let updated = 0;
    let conflict = false;
    try {
      for (const id of selected) {
        const progress = progressByItem.get(id);
        if ((progress?.status || "not_started") === bulkStatus) continue;
        try {
          await api.put(`/ships/${shipId}/progress/${id}`, {
            status: bulkStatus,
            notes: progress?.notes ?? null,
            updated_by: user,
            expected_revision: progress?.revision ?? 0,
          });
          updated += 1;
        } catch (error) {
          if (error?.status === 409) {
            conflict = true;
            break;
          }
          throw error;
        }
      }
      if (conflict) toast.error(t("ship.toast.conflict"));
      else toast.success(t("ship.bulk.done", { n: updated }));
      setSelected(new Set());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBulkBusy(false);
      refreshProgress();
    }
  }

  if (treeQuery.isLoading || shipsQuery.isLoading || progressQuery.isLoading) return <LoadingPanel />;
  if (treeQuery.isError) return <ErrorPanel message={errorMessage(treeQuery.error)} retry={() => treeQuery.refetch()} />;
  if (progressQuery.isError) {
    return <ErrorPanel message={errorMessage(progressQuery.error)} retry={() => progressQuery.refetch()} />;
  }

  const ship = (shipsQuery.data ?? []).find((row) => String(row.id) === String(shipId));
  const hull = ship?.hull_no ?? `#${shipId}`;
  const groupIds = flat.filter((item) => item.children?.length).map((item) => item.id);

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(`/projects/${projectId}`)}>
        <ArrowLeft size={14} />
        {t("ship.back")}
      </button>

      <PageHeader
        eyebrow={`${hull}${ship?.name ? " · " + ship.name : ""}`}
        title={t("ship.itp.title", { hull })}
        description={t("ship.itp.desc")}
        actions={
          <>
            <Button
              variant="soft"
              onClick={() =>
                downloadFile(`/ships/${shipId}/unfinished-before-sea-trial/export.pdf`, `${hull}-before-sea-trial.pdf`).catch(
                  (error) => toast.error(errorMessage(error)),
                )
              }
            >
              <Download size={15} />
              {t("ship.export.beforeTrial")}
            </Button>
            <Button
              variant="soft"
              onClick={() =>
                downloadFile(`/ships/${shipId}/unfinished-before-delivery/export.pdf`, `${hull}-before-delivery.pdf`).catch(
                  (error) => toast.error(errorMessage(error)),
                )
              }
            >
              <Download size={15} />
              {t("ship.export.beforeDelivery")}
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="soft"
                  onClick={() =>
                    downloadFile(`/ships/${shipId}/records/export`, `${hull}-records.xlsx`).catch((error) =>
                      toast.error(errorMessage(error)),
                    )
                  }
                >
                  <Download size={15} />
                  {t("ship.export.records")}
                </Button>
                <Button variant="soft" onClick={() => recordsInputRef.current?.click()} loading={importRecordsMutation.isPending}>
                  <Upload size={15} />
                  {t("ship.import.records")}
                </Button>
                <input
                  ref={recordsInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file && window.confirm(t("ship.import.records.confirm", { hull }))) {
                      importRecordsMutation.mutate(file);
                    }
                  }}
                />
              </>
            )}
            <Link to={`/projects/${projectId}/ships/${shipId}/stats`} className="btn soft-button">
              <BarChart3 size={15} />
              {t("ship.stats")}
            </Link>
            {isAdmin && (
              <Button onClick={() => setEditing(null)}>
                <ClipboardPlus size={15} />
                {t("ship.item.add")}
              </Button>
            )}
          </>
        }
      />

      <section className="card" style={{ padding: 12 }}>
        <div className="toolbar">
          <div className="search-box">
            <Search size={15} />
            <input placeholder={t("ship.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minWidth: 130 }}>
            <option value="">{t("ship.status.all")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
          <button type="button" className={`filter-toggle ${beforeOnly ? "on" : ""}`} onClick={() => setBeforeOnly(!beforeOnly)}>
            <Flag size={13} />
            {t("ship.beforeOnly")}
          </button>
          {isAdmin && (
            <button type="button" className={`filter-toggle ${showInactive ? "on" : ""}`} onClick={() => setShowInactive(!showInactive)}>
              <Eye size={13} />
              {t("ship.showInactive")}
            </button>
          )}
          <div className="seg-control">
            <button type="button" className={view === "tree" ? "active" : ""} onClick={() => setView("tree")}>
              {t("ship.view.tree")}
            </button>
            <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")}>
              {t("ship.view.table")}
            </button>
          </div>
          {view === "tree" && (
            <>
              <button type="button" className="filter-toggle" onClick={() => setCollapsed(new Set(groupIds))}>
                <ChevronsDownUp size={13} />
                {t("ship.collapse")}
              </button>
              <button type="button" className="filter-toggle" onClick={() => setCollapsed(new Set())}>
                <ChevronsUpDown size={13} />
                {t("ship.expand")}
              </button>
            </>
          )}
          {filterActive && (
            <button
              type="button"
              className="filter-toggle"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setBeforeOnly(false);
              }}
            >
              <X size={13} />
              {t("ship.clear")}
            </button>
          )}
        </div>
      </section>

      {selected.size > 0 && (
        <section className="bulk-bar">
          <div className="bulk-info">{t("ship.selected", { n: selected.size })}</div>
          <div className="bulk-actions">
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </select>
            <Button loading={bulkBusy} onClick={applyBulk}>{t("ship.bulk.apply")}</Button>
            <Button variant="soft" onClick={() => setSelected(new Set())}>{t("ship.bulk.unselect")}</Button>
          </div>
        </section>
      )}

      <section className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            title={t("ship.empty.title")}
            description={flat.length ? t("ship.empty.filtered") : t("ship.empty.none")}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(selectableRows.map((item) => item.id)))
                      }
                    />
                  </th>
                  <th>{t("ship.col.item")}</th>
                  <th>{t("ship.col.flag")}</th>
                  <th>{t("ship.col.status")}</th>
                  <th>{t("ship.col.updated")}</th>
                  <th>{t("ship.col.notes")}</th>
                  <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isLeaf = Boolean(item.is_inspection);
                  const progress = progressByItem.get(item.id);
                  const status = progress?.status || "not_started";
                  const hasChildren = Boolean(item.children?.length);
                  const indent = view === "tree" && !filterActive ? Math.max(0, (item.level || 1) - 1) * 18 : 0;
                  const inactive = item.active === false;
                  return (
                    <tr key={item.id} className={`${isLeaf ? "" : "group-row"} ${inactive ? "inactive-row" : ""}`.trim()}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!isLeaf || inactive}
                          style={!isLeaf || inactive ? { opacity: 0.2 } : undefined}
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "flex-start", paddingLeft: indent, minWidth: 0 }}>
                          {view === "tree" && !filterActive && (
                            <button
                              type="button"
                              className="tree-row-toggle"
                              style={{ marginRight: 4, marginTop: 3 }}
                              disabled={!hasChildren}
                              onClick={() =>
                                setCollapsed((current) => {
                                  const next = new Set(current);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                })
                              }
                            >
                              {collapsed.has(item.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          <span style={{ marginRight: 8, marginTop: 3, color: isLeaf ? "#0d9488" : "var(--text-muted)", flexShrink: 0 }}>
                            {isLeaf ? <FileText size={14} /> : <FolderTree size={14} />}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span className="code-tag">{item.code}</span>
                              <span className={isLeaf ? "" : "cell-main"} style={{ fontSize: 13.5 }}>
                                {item.title_zh || item.title_en}
                              </span>
                            </div>
                            {item.title_zh && item.title_en && (
                              <div className="cell-sub" style={{ marginTop: 1 }}>{item.title_en}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.before_sea_trial ? (
                          <span className="status-chip status-not_applicable" style={{ gap: 5 }}>
                            <Flag size={11} />
                            {t("ship.before.flag")}
                          </span>
                        ) : (
                          <span className="cell-sub">{t("common.none")}</span>
                        )}
                      </td>
                      <td>
                        {isLeaf ? (
                          <StatusSelect
                            value={status}
                            disabled={inactive || statusMutation.isPending}
                            ariaLabel={t("ship.col.status")}
                            onChange={(nextStatus) =>
                              statusMutation.mutate({
                                itemId: item.id,
                                status: nextStatus,
                                notes: progress?.notes ?? null,
                                expectedRevision: progress?.revision ?? 0,
                              })
                            }
                          />
                        ) : (
                          <span className="cell-sub">{t("common.none")}</span>
                        )}
                      </td>
                      <td>
                        {progress?.updated_by ? (
                          <>
                            <div className="cell-sub" style={{ color: "var(--text)" }}>{progress.updated_by}</div>
                            <div className="cell-sub" style={{ fontSize: 11.5 }}>
                              {formatDateTime(progress.completed_at || progress.updated_at)}
                            </div>
                          </>
                        ) : (
                          <span className="cell-sub">{t("common.none")}</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <span className="cell-sub" title={progress?.notes || ""} style={{ display: "inline-block", maxWidth: 190, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle" }}>
                          {progress?.notes || t("common.none")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                          {isLeaf && !inactive && (
                            <IconButton
                              title={t("ship.notes.edit")}
                              onClick={() => {
                                setNotesRow(item);
                                setNotesDraft(progress?.notes || "");
                              }}
                            >
                              <StickyNote size={14} />
                            </IconButton>
                          )}
                          {isAdmin && (
                            <>
                              <IconButton
                                title={item.before_sea_trial ? t("ship.item.beforeTrial.off") : t("ship.item.beforeTrial.on")}
                                on={Boolean(item.before_sea_trial)}
                                onClick={() => flagMutation.mutate(item.id)}
                              >
                                <Flag size={14} />
                              </IconButton>
                              <IconButton title={t("ship.item.edit")} onClick={() => setEditing(item)}>
                                <Pencil size={14} />
                              </IconButton>
                              <IconButton
                                title={inactive ? t("ship.item.activate") : t("ship.item.deactivate")}
                                on={inactive}
                                onClick={() => activeMutation.mutate({ itemId: item.id, active: inactive })}
                              >
                                <Power size={14} />
                              </IconButton>
                              <IconButton danger title={t("ship.item.delete.title")} onClick={() => setDeleting(item)}>
                                <Trash2 size={14} />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "9px 16px",
            borderTop: "1px solid #edf2f7",
            background: "#f7faf9",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <span>{t("ship.footer", { shown: filtered.length, total: flat.length })}</span>
          <span>{hull}</span>
        </div>
      </section>

      <ItemEditorModal
        open={editing !== undefined}
        item={editing ?? null}
        allItems={flat}
        projectId={projectId}
        onClose={() => setEditing(undefined)}
      />

      <Modal
        open={Boolean(notesRow)}
        onClose={() => setNotesRow(null)}
        title={t("ship.notes.title")}
        description={notesRow ? `${notesRow.code} · ${notesRow.title_zh || notesRow.title_en}` : ""}
        footer={
          <>
            <Button variant="soft" onClick={() => setNotesRow(null)}>{t("common.cancel")}</Button>
            <Button
              loading={statusMutation.isPending}
              onClick={() => {
                const progress = progressByItem.get(notesRow.id);
                statusMutation.mutate(
                  {
                    itemId: notesRow.id,
                    status: progress?.status || "not_started",
                    notes: notesDraft.trim() || null,
                    expectedRevision: progress?.revision ?? 0,
                  },
                  { onSuccess: () => setNotesRow(null) },
                );
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <textarea
          rows={4}
          style={{ width: "100%" }}
          placeholder={t("ship.notes.placeholder")}
          value={notesDraft}
          onChange={(event) => setNotesDraft(event.target.value)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t("ship.item.delete.title")}
        description={t("ship.item.delete.desc", {
          code: deleting?.code ?? "",
          name: deleting ? deleting.title_zh || deleting.title_en : "",
        })}
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  );
}
