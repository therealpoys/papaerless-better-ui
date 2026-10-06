# 0008 – Android-App mit Capacitor

**Status:** entschieden (2026-10-06)

## Kontext
ADR [0001](0001-tech-stack.md) hat für Mobile **Expo (React Native)** gewählt (`apps/mobile`). Die Web-App
(`apps/web`) ist inzwischen deutlich weiter: Prüfliste, Ordner/Filter, Einstellungen, Hilfe und
Handy-Ansicht (wischbare Reiter, kompakte Karten). `apps/mobile` deckt davon nur einen Teil ab; jede
Funktion müsste doppelt (React Native + Web) gebaut und gepflegt werden.

## Optionen
| Option | Pro | Contra |
|---|---|---|
| `apps/mobile` (Expo) ausbauen | echte native UI | doppelte UI-Pflege, Rückstand zur Web-App bleibt |
| PWA | kein natives Tooling | kein "Teilen mit…", eingeschränkter Kamera-/Push-Zugriff, kein APK |
| **Capacitor um `apps/web`** | eine UI für Web und Android, native Hülle (Share-Intent, Kamera, Push) | WebView statt nativer UI, Android-Toolchain (JDK/SDK) nötig |

## Entscheidung
Android läuft als **Capacitor-Hülle um die bestehende Web-App**: neues Package `apps/android`
(`@papaerless/android`) mit `webDir: ../web/dist`, `appId: de.papaerless.app`, `androidScheme: https`.
`apps/mobile` (Expo) bleibt unangetastet bestehen, wird aber nicht weiter ausgebaut.

Das weicht bewusst von 0001 ("Mobile: Expo") ab; 0001 verweist auf diesen ADR.

## Konsequenzen
- Das Android-Projekt (`apps/android/android/`) ist eingecheckt; Build-Artefakte, `local.properties`
  und kopierte Web-Assets sind per `.gitignore` ausgeschlossen.
- Manifest: `CAMERA`, `INTERNET`, `POST_NOTIFICATIONS`, Intent-Filter für `SEND`/`SEND_MULTIPLE`
  (`application/pdf`, `image/*`) und `usesCleartextTraffic` (lokales Paperless/API im LAN per http).
  Der Web-Teil muss geteilte Dateien noch entgegennehmen (separate Aufgabe in `apps/web`).
- Der Paperless-Token bleibt im Backend (`services/api`); die App spricht nur die API an. Die API-URL
  wird zur Build-Zeit über `VITE_API_URL` gesetzt (siehe `apps/android/README.md`).
- Capacitor-CLI 8 braucht Node >= 22 (nur für `apps/android`; Rest des Repos weiterhin Node >= 20).
- `pnpm build`/`pnpm typecheck` des Gesamt-Repos brauchen kein Java/Android-SDK; die APK baut
  `pnpm --filter @papaerless/android build:apk` lokal (JDK 17 + Android SDK) oder der CI-Job `android-apk`.
- Debug-APK ist nicht signiert für Release; Play-Store-Release (Signing, Icons) ist offen.
