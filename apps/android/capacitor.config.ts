import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.papaerless.app",
  appName: "Paperless Better UI",
  webDir: "../web/dist",
  android: {
    // WebView läuft auf https://localhost, API im LAN per http → sonst Mixed Content
    allowMixedContent: true,
  },
  server: {
    androidScheme: "https",
    // Lokales Paperless/API im LAN läuft per http
    cleartext: true,
  },
};

export default config;
