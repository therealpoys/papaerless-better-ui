# infra

- `docker-compose.yml` – Gesamtstack (Paperless, Redis, api, web, optional mail-ingest), siehe
  README "Produktiv betreiben" und [ADR 0004](../docs/decisions/0004-deployment.md)
- `docker/` – Dockerfiles (`node-service.Dockerfile` für api/mail-ingest, `web.Dockerfile` + `nginx.conf.template`)
- `paperless/` – Docker-Compose nur für ein lokales Paperless-ngx (Entwicklung/Test)

Lokale Paperless-Daten (`data/`, `media/`, `consume/`, `pgdata/`) sind in `.gitignore`.
