// Brisolo HQ: the founder's own dashboard (CLAUDE.md 2, 10 step 15), a separate site from the
// restaurant app. Only existing accounts can ask for a login link (no sign-ups here), and only
// accounts in private.founders get any data: the database checks it on every call.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
