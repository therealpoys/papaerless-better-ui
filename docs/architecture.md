# Architektur

```
 ┌──────────────┐   ┌──────────────┐   ┌───────────────┐
 │ apps/mobile  │   │   apps/web   │   │ mail-ingest   │
 │ (Kamera)     │   │ (Review/UI)  │   │ (IMAP)        │
 └──────┬───────┘   └──────┬───────┘   └──────┬────────┘
        │                  │                  │
        └─────────┬────────┴──────────────────┘
                  ▼
          ┌───────────────┐        ┌──────────────────┐
          │  services/api │───────▶│ ai-classifier    │
          │  (Gateway)    │◀───────│ (LLM-Vorschläge) │
          └───────┬───────┘        └──────────────────┘
                  │ REST-API (Token)
                  ▼
          ┌───────────────┐
          │ Paperless-ngx │  OCR, Speicherung, Suche
          └───────────────┘
```

## Kern-Flow
1. Foto / Datei / Mail kommt rein (Mobile, Web oder mail-ingest)
2. `api` lädt sie zu Paperless hoch
3. Paperless macht OCR → Dokument-ID
4. `api` holt OCR-Text, ruft `ai-classifier` auf
5. Vorschlag landet in der **Review-Inbox**
6. User bestätigt/korrigiert → `api` schreibt Metadaten nach Paperless

## Offene Fragen
- Wo werden Vorschläge gespeichert? (eigene DB vs. Paperless Custom Fields / Notes / Inbox-Tag)
- Auto-Übernahme ab bestimmter Konfidenz?
- Hosting: alles auf demselben Server wie Paperless? Zugriff von unterwegs (VPN, Reverse Proxy)?
