import { CircleAlert, Inbox, LoaderCircle, X } from "lucide-react";
import { useI18n } from "../lib/i18n";

export const STATUSES = ["not_started", "in_progress", "done", "not_applicable"];

export function Button({ variant = "primary", loading, disabled, children, className = "", ...props }) {
  const variantClass = {
    primary: "",
    soft: "soft-button",
    danger: "danger-button",
    ghost: "ghost-button",
  }[variant];
  return (
    <button className={`${variantClass} ${className}`.trim()} disabled={disabled || loading} {...props}>
      {loading && <LoaderCircle size={15} className="btn-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ title, danger, on, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${danger ? "danger" : ""} ${on ? "on" : ""} ${className}`.trim()}
      title={title}
      aria-label={title}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, description, wide, children, footer }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`modal-panel ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h3>{title}</h3>
            {description && <p className="sub">{description}</p>}
          </div>
          <IconButton title={t("common.close")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </section>
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, danger = true, loading, onClose, onConfirm }) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t("common.confirm.delete")}
          </Button>
        </>
      }
    >
      <div className={`alert-box ${danger ? "danger" : "info"}`}>
        <CircleAlert size={17} />
        <p style={{ margin: 0 }}>{description}</p>
      </div>
    </Modal>
  );
}

export function ProgressBar({ value, showLabel = true }) {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-row">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${bounded}%` }} />
      </div>
      {showLabel && <span className="progress-label">{Math.round(bounded * 10) / 10}%</span>}
    </div>
  );
}

export function StatusChip({ status }) {
  const { t } = useI18n();
  return (
    <span className={`status-chip status-${status}`}>
      <span className="dot" />
      {t(`status.${status}`)}
    </span>
  );
}

export function StatusSelect({ value, onChange, disabled, ariaLabel }) {
  const { t } = useI18n();
  return (
    <select
      className={`status-select status-${value}`}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {t(`status.${status}`)}
        </option>
      ))}
    </select>
  );
}

export function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {Icon && <Icon size={14} />}
        {label}
      </div>
      <div className="metric-value">{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, flush, children }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="anchor">{title}</h2>}
            {description && <p className="sub">{description}</p>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
        </div>
      )}
      <div className={`panel-body ${flush ? "flush" : ""}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="desc">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={20} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function LoadingPanel() {
  const { t } = useI18n();
  return (
    <div className="panel loading-panel">
      <LoaderCircle size={18} />
      <span>{t("common.loading")}</span>
    </div>
  );
}

export function ErrorPanel({ message, retry }) {
  const { t } = useI18n();
  return (
    <div className="panel empty-state" style={{ minHeight: 180 }}>
      <div className="empty-icon" style={{ background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca" }}>
        <CircleAlert size={20} />
      </div>
      <h3>{t("common.error.load")}</h3>
      <p>{message}</p>
      {retry && (
        <Button variant="soft" style={{ marginTop: 14 }} onClick={retry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field-row">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
