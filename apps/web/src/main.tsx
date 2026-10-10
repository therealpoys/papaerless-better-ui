import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppLockGate } from "./components/AppLockGate";
import { ServerSetup } from "./components/ServerSetup";
import { isNative } from "./lib/platform";
import { getStoredServerUrl, needsServerSetup } from "./lib/serverUrl";
import "./i18n";
import "@papaerless/ui/src/tokens.css";
import "@papaerless/ui/src/components.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {needsServerSetup(isNative(), getStoredServerUrl()) ? (
      <ServerSetup onDone={() => window.location.reload()} />
    ) : (
      <AppLockGate>
        <App />
      </AppLockGate>
    )}
  </StrictMode>,
);
