# 0006 – Lokale KI-Erkennung mit Ollama

**Status:** entschieden (2026-10-04)

## Kontext
Die Metadaten-Vorschläge liefen bisher nur über die Anthropic-API (Kosten, Dokumenttexte verlassen den Server).
Der Server hat 4 CPU-Kerne, 15 GB RAM, keine GPU.

## Entscheidung
Zusätzlicher Provider `AI_PROVIDER=ollama` (`services/ai-classifier/src/ollama-provider.ts`), der `POST /api/chat`
mit `format: "json"`, `temperature: 0` und `num_ctx: 8192` aufruft. Konfiguration: `AI_MODEL`, `AI_BASE_URL`
(Default `http://localhost:11434`). Ollama läuft als Docker-Container `ollama`, nur an `127.0.0.1:11434` gebunden.

Modell: `qwen3:4b-instruct-2507-q4_K_M` (~2,5 GB, gutes Deutsch, zuverlässiges JSON). Alternative: `gemma3:4b`.

## Konsequenzen
- Keine Kosten, Dokumenttexte bleiben lokal.
- Auf CPU dauert ein Vorschlag ca. 1–2,5 Minuten (gemessen: 2:15 min bei einem Testdokument); Qualität unter
  der von Claude – Vorschläge bleiben, wie immer, Vorschläge, die der User bestätigt.
- Der Container muss laufen (`restart unless-stopped`); fällt er aus, schlagen Vorschläge mit Ollama-Fehler fehl.
