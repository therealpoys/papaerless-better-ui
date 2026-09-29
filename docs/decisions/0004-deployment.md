# 0004 – Deployment auf dem Paperless-Server

Status: akzeptiert

## Kontext
Die offene Hosting-Frage aus `docs/architecture.md` (gleicher Server wie Paperless? Reverse Proxy/VPN?)
blockierte Dockerfiles und CI. Zielgruppe ist Einzel-/Familiennutzung (siehe Auth-Stand in
`docs/roadmap.md`, Phase 6: ein geteiltes `API_AUTH_TOKEN`, kein Multi-User-Login).

## Optionen
1. Eigener Server/Cloud-Host für unsere Services, Paperless woanders – zusätzlicher Betrieb, Paperless-Token
   und Dokumente laufen über öffentliche Strecken.
2. **Gleicher Server/Docker-Host wie Paperless, ein Compose-Stack** – Services sprechen Paperless über das
   interne Compose-Netz, nichts davon muss öffentlich sein.
3. Kubernetes/Managed – für den Nutzungsumfang überdimensioniert.

## Entscheidung
Option 2: `infra/docker-compose.yml` startet `broker` + `paperless` + `api` + `web` (+ optional `mail-ingest`
über das Compose-Profil `mail`, da der Service ohne IMAP-Konfiguration mit Exit 0 endet).

- **Images:** `infra/docker/node-service.Dockerfile` (api, mail-ingest; esbuild-Bundle, Runtime ohne
  `node_modules`, Nutzer `node`, read-only Root-FS) und `infra/docker/web.Dockerfile` (Vite-Build hinter
  `nginx-unprivileged`). `ai-classifier` ist Bibliothek von `api` und wird mit eingebündelt. Grund fürs Bundle:
  die Workspace-Packages exportieren `.ts`-Quellen, die Node zur Laufzeit nicht laden kann.
- **Netz:** Nur `web` (Port 8080) ist für Clients gedacht. nginx reicht `/api/` an `api:3001` durch, daher
  `VITE_API_URL=""` (relative URLs, kein CORS). Host-Ports sind standardmäßig an `127.0.0.1` gebunden.
- **Daten:** Named Volumes; `api-data` (Reminders, Push-Subscriptions, KI-Vorschläge) und `mail-data`
  (verarbeitete Message-IDs) gehören ins Backup (siehe ADR 0003) – Paperless bleibt Source of Truth für Dokumente.
- **Reverse Proxy / TLS:** Vor `web` (und ggf. `paperless`) einen TLS-terminierenden Reverse Proxy
  (Caddy/Traefik/nginx mit Let's Encrypt) **oder** ausschließlich Zugriff per VPN (WireGuard/Tailscale).
  Empfehlung: VPN, falls die Mobile-App nur von eigenen Geräten genutzt wird; sonst TLS + zusätzlich
  Basic-Auth/SSO-Forward-Auth am Proxy. Web Push und Kamera-Zugriff im Browser erfordern HTTPS.
  Ohne TLS/VPN nichts auf `0.0.0.0` binden.
- **Token-Handling:**
  - `PAPERLESS_API_TOKEN` existiert nur als Env des `api`- und `mail-ingest`-Containers, nie in Apps oder Images.
  - `API_AUTH_TOKEN` wird von `scripts/setup.sh` zufällig erzeugt. nginx setzt ihn serverseitig als
    `Authorization`-Header für `/api/`; er steckt daher **nicht** im Web-Bundle (kein `VITE_API_TOKEN`).
    Konsequenz: Wer `web` erreicht, hat vollen API-Zugriff – der Schutz muss also VPN/Proxy-Auth leisten.
    Die Mobile-App nutzt weiter `EXPO_PUBLIC_API_TOKEN` (steckt im App-Bundle; bekannter Kompromiss des
    Shared-Token-Modells, bis echtes Login existiert).
  - Alle Secrets ausschließlich in `.env` (gitignored, `chmod 600`).
- **Bootstrap-Reihenfolge:** Paperless zuerst starten, Token im UI erzeugen, dann Rest (siehe README).

## Konsequenzen
- Ein `docker compose up` reicht für den Gesamtbetrieb; Updates per `git pull && docker compose up -d --build`.
- Paperless-Image ist `latest`; für Produktion auf eine feste Version pinnen und Updates bewusst einspielen.
- Nicht enthalten: CI (`.github/workflows`), Image-Registry, Monitoring, automatische Backups – bleiben offen
  in der Roadmap. Für Multi-User-Auth wäre ein eigener ADR nötig.
