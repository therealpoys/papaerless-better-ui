import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@papaerless/ui/src/tokens.css";
import "@papaerless/ui/src/components.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
