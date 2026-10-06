# apps/android

Android-App als [Capacitor](https://capacitorjs.com)-Hülle um `apps/web` (Entscheidung:
[ADR 0008](../../docs/decisions/0008-android-app-mit-capacitor.md)). `apps/mobile` (Expo) ist davon unabhängig.

## Voraussetzungen
- Node >= 22 (Capacitor-CLI 8), pnpm
- JDK 21 und Node 22 und Android SDK (`ANDROID_HOME` gesetzt, oder Android Studio) – nur zum APK-Bauen

## Bauen
```bash
pnpm install
pnpm --filter @papaerless/android sync       # Web bauen + Assets ins Android-Projekt kopieren
pnpm --filter @papaerless/android open       # in Android Studio öffnen
pnpm --filter @papaerless/android build:apk  # Debug-APK per Gradle
```
APK: `apps/android/android/app/build/outputs/apk/debug/app-debug.apk`.
`pnpm build` / `pnpm typecheck` im Repo-Root prüfen hier nur die Config und brauchen kein Android-SDK.
Die CI (Job `android-apk` in `.github/workflows/ci.yml`) baut die Debug-APK und lädt sie als Artifact hoch.

## Auf dem Gerät installieren
1. Am Handy Entwickleroptionen und USB-Debugging aktivieren, per USB verbinden.
2. `adb install -r apps/android/android/app/build/outputs/apk/debug/app-debug.apk`
   (oder die APK aus dem CI-Artifact aufs Handy kopieren und "Unbekannte Apps installieren" erlauben).
3. Beim ersten Start Kamera- und Benachrichtigungs-Berechtigung erlauben.

## Server-URL der API einstellen
Die App spricht nur `services/api` an (nie Paperless direkt). Beim ersten Start fragt ein Einrichtungsbildschirm nach der Server-URL (z. B. `http://192.168.1.10:3001`), testet die Verbindung und speichert sie; später änderbar unter Einstellungen. Optional kann ein Token zur Build-Zeit eingebettet werden:
```bash
VITE_API_TOKEN=<token> pnpm --filter @papaerless/android build:apk
```
`localhost` zeigt auf dem Handy auf das Handy selbst – die LAN-IP bzw. den Hostnamen des Servers verwenden.
Http im LAN ist erlaubt (`usesCleartextTraffic`). Das Token ist im Bundle sichtbar, daher nur für das
eigene Gerät/Netz bauen.

## Teilen mit…
Das Manifest nimmt `ACTION_SEND`/`ACTION_SEND_MULTIPLE` für PDF und Bilder an, sodass die App im
Android-Teilen-Menü erscheint. Die Verarbeitung der geteilten Dateien passiert in der Web-App.

## Icons und Splash
Icons sind Capacitor-Platzhalter (`android/app/src/main/res/mipmap-*`), vor einem Release ersetzen.
Der Splash-Hintergrund folgt Hell/Dunkel (`res/values/colors_splash.xml`, `res/values-night/`).
