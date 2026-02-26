import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Carrega ferramentas de diagnóstico (disponível em window.__diagnosticSettings)
import "./lib/diagnostic-settings.ts";

createRoot(document.getElementById("root")!).render(<App />);
