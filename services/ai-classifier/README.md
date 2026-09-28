# services/ai-classifier – KI-Erkennung

Input: OCR-Text (von Paperless) + ggf. Bild.
Output: strukturierter Vorschlag, z.B.

- Dokumenttyp (Rechnung, Vertrag, Brief, Lohnabrechnung, …)
- Korrespondent (Absender)
- Titel / kurze Zusammenfassung
- Datum, Betrag, Fälligkeit
- Tags
- Konfidenz pro Feld

Nutzt vorhandene Tags/Korrespondenten/Dokumenttypen aus Paperless als Auswahl, damit keine Duplikate entstehen.
Prompts liegen in `prompts/`.
