import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoadingPanel } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ToastProvider } from "./lib/toast";
import { Login } from "./pages/Login";
import "./styles.css";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Projects = lazy(() => import("./pages/Projects").then((m) => ({ default: m.Projects })));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail })));
const ProjectStats = lazy(() => import("./pages/ProjectStats").then((m) => ({ default: m.ProjectStats })));
const ShipItp = lazy(() => import("./pages/ShipItp").then((m) => ({ default: m.ShipItp })));
const ShipStats = lazy(() => import("./pages/ShipStats").then((m) => ({ default: m.ShipStats })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="panel empty-state">
      <h3>{t("common.page.missing")}</h3>
      <p>{t("common.page.missing.desc")}</p>
    </div>
  );
}

function App() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Login />;
  return (
    <Suspense fallback={<div className="page"><LoadingPanel /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/:projectId/stats" element={<ProjectStats />} />
          <Route path="projects/:projectId/ships/:shipId/itp" element={<ShipItp />} />
          <Route path="projects/:projectId/ships/:shipId/stats" element={<ShipStats />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
