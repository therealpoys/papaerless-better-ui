# services/api – Backend / Gateway

Einziger Service, der mit Paperless-ngx spricht.

- Auth für Web + Mobile
- Upload entgegennehmen → an Paperless (`/api/documents/post_document/`) weiterreichen
- Task-Status von Paperless verfolgen (`/api/tasks/`)
- Nach OCR: `ai-classifier` aufrufen, Vorschläge speichern
- Bestätigte Vorschläge als Metadaten in Paperless schreiben
- Liefert Daten für Review-Inbox, Suche, Dashboard
