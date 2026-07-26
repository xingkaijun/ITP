import { useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "../components/ui";
import { BUILD_TAG } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

const APP_BASE = import.meta.env.BASE_URL || "/";

export function Login() {
  const { t, toggleLocale } = useI18n();
  const { loginWithNbins, loginWithLocal } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [useLocal, setUseLocal] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event?.preventDefault();
    setMessage("");
    if (!useLocal && !username.trim()) {
      setMessage(t("login.username.required"));
      return;
    }
    setBusy(true);
    try {
      if (useLocal) await loginWithLocal(password);
      else await loginWithNbins(username.trim(), password);
    } catch (error) {
      setMessage((useLocal ? t("login.failed.local") : t("login.failed.nbins")) + error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="ghost" style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }} onClick={toggleLocale}>
            <Languages size={13} />
            {t("lang.toggle")}
          </Button>
        </div>
        <div className="login-brand">
          <div className="login-logo">
            <img src={`${APP_BASE}pg-logo.png`} alt="PG" />
          </div>
          <h1 className="brand">{t("app.name")}</h1>
          <p>{useLocal ? t("login.subtitle.local") : t("login.subtitle")}</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          {message && <div className="login-error">{message}</div>}
          {!useLocal && (
            <input
              type="text"
              placeholder={t("login.username")}
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          )}
          <input
            type="password"
            placeholder={useLocal ? t("login.password.local") : t("login.password")}
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" loading={busy}>{t("login.submit")}</Button>
          <Button
            type="button"
            variant="ghost"
            style={{ fontSize: 12.5 }}
            onClick={() => {
              setUseLocal(!useLocal);
              setMessage("");
            }}
          >
            {useLocal ? t("login.useNbins") : t("login.useLocal")}
          </Button>
        </form>

        <p className="login-meta">build {BUILD_TAG}</p>
      </section>
    </main>
  );
}
