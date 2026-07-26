import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((message, kind = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, kind, key: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), kind === "error" ? 5000 : 3200);
  }, []);

  const success = useCallback((message) => show(message, "success"), [show]);
  const error = useCallback((message) => show(message, "error"), [show]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {toast && (
        <div key={toast.key} className={`toast ${toast.kind === "error" ? "error" : ""}`} role="status">
          {toast.kind === "error" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
