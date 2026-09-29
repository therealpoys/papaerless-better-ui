#!/usr/bin/env bash
# Erst-Einrichtung für den Docker-Betrieb: legt .env aus .env.example an und füllt Secrets.
# Idempotent: bereits gesetzte Werte werden NICHT überschrieben.
#   ./scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { cp .env.example "$ENV_FILE"; chmod 600 "$ENV_FILE"; echo "-> $ENV_FILE aus .env.example angelegt"; }

rand() { # rand <bytes>: zufälliger Hex-String
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"
  else head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

get() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//'; }

set_if_empty() { # set_if_empty KEY VALUE
  local key="$1" value="$2"
  if [ -z "$(get "$key")" ]; then
    if grep -qE "^$key=" "$ENV_FILE"; then
      sed -i.bak -E "s|^$key=.*|$key=$value|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    else
      printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
    echo "-> $key erzeugt"
  else
    echo "   $key bereits gesetzt (unverändert)"
  fi
}

set_if_empty API_AUTH_TOKEN "$(rand 32)"
set_if_empty PAPERLESS_SECRET_KEY "$(rand 32)"
set_if_empty PAPERLESS_ADMIN_PASSWORD "$(rand 12)"

# VAPID-Keys für Web Push (optional; braucht Node)
if [ -z "$(get WEB_PUSH_PUBLIC_KEY)" ]; then
  echo
  echo "Web-Push (Erinnerungen) ist noch nicht konfiguriert. VAPID-Keys erzeugen mit:"
  echo "    npx web-push generate-vapid-keys"
  echo "  und Public/Private Key in $ENV_FILE als WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY eintragen"
  echo "  (WEB_PUSH_CONTACT_EMAIL=mailto:du@example.org). Ohne Keys bleibt Push deaktiviert."
fi

cat <<EOF

Nächste Schritte
1. Paperless (und Redis) starten:
     docker compose --env-file .env -f infra/docker-compose.yml up -d paperless
2. Im Browser http://localhost:8000 öffnen, mit '$(get PAPERLESS_ADMIN_USER)' und dem Passwort aus
   $ENV_FILE (PAPERLESS_ADMIN_PASSWORD) einloggen.
3. API-Token erzeugen: Benutzer-Menü oben rechts > "My Profile" > Token-Symbol (Kreis-Pfeil) >
   kopieren, und in $ENV_FILE als PAPERLESS_API_TOKEN eintragen.
   (Alternativ: docker compose ... exec paperless python3 manage.py drf_create_token <user>)
   Das Token bleibt im Backend – niemals in Apps/Frontend-Builds.
4. Rest starten:
     docker compose --env-file .env -f infra/docker-compose.yml up -d --build
   Mail-Ingest zusätzlich (nach Eintragen der MAIL_IMAP_*-Werte):
     docker compose --env-file .env -f infra/docker-compose.yml --profile mail up -d --build
5. Web-UI: http://localhost:$(get WEB_PORT) (Default 8080)

Hinweis: Ohne TLS-Reverse-Proxy oder VPN nicht ins Internet exponieren – siehe
docs/decisions/0004-deployment.md. Die Mobile-App bekommt API_AUTH_TOKEN als
EXPO_PUBLIC_API_TOKEN (Wert steht in $ENV_FILE).
EOF
