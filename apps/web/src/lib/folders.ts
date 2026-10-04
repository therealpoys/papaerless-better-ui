import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  Folder,
  FolderCriterion,
  Tag,
} from "@papaerless/shared-types";

export type FolderCriterionKind = FolderCriterion["kind"];

export const FOLDER_CRITERION_KINDS: FolderCriterionKind[] = ["tag", "correspondent", "documentType"];

/** Suchparameter, mit denen die Dokumente eines Ordners über api.listDocuments geladen werden.
 *  `extra` kann zusätzliche Suchfilter enthalten; das Ordnerkriterium gilt immer mit
 *  (Schlagwörter werden ergänzt, Absender/Art des Ordners überschreiben den Filter). */
export function criterionToSearchParams(criterion: FolderCriterion, extra: DocumentSearchParams = {}): DocumentSearchParams {
  switch (criterion.kind) {
    case "tag":
      return { ...extra, tags: [...new Set([...(extra.tags ?? []), criterion.id])] };
    case "correspondent":
      return { ...extra, correspondent: criterion.id };
    case "documentType":
      return { ...extra, documentType: criterion.id };
  }
}

export interface FolderLookups {
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
}

/** Name des Kriteriums (z. B. "Steuer"); null, wenn der Eintrag in Paperless nicht mehr existiert. */
export function criterionName(criterion: FolderCriterion, lookups: FolderLookups): string | null {
  const list =
    criterion.kind === "tag"
      ? lookups.tags
      : criterion.kind === "correspondent"
        ? lookups.correspondents
        : lookups.documentTypes;
  return list.find((o) => o.id === criterion.id)?.name ?? null;
}

export type FolderValidationError = "nameRequired" | "nameTooLong" | "criterionRequired";

export const MAX_FOLDER_NAME_LENGTH = 80;

export interface FolderDraft {
  name: string;
  kind: FolderCriterionKind;
  criterionId: number | null;
}

/** Prüft die Eingaben des Dialogs; liefert bereinigte Daten oder einen Fehlercode (für i18n). */
export function validateFolderDraft(
  draft: FolderDraft,
): { ok: true; value: { name: string; criterion: FolderCriterion } } | { ok: false; error: FolderValidationError } {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "nameRequired" };
  if (name.length > MAX_FOLDER_NAME_LENGTH) return { ok: false, error: "nameTooLong" };
  if (draft.criterionId === null) return { ok: false, error: "criterionRequired" };
  return { ok: true, value: { name, criterion: { kind: draft.kind, id: draft.criterionId } } };
}

export function draftFromFolder(folder: Folder): FolderDraft {
  return { name: folder.name, kind: folder.criterion.kind, criterionId: folder.criterion.id };
}

/** Nur geänderte Felder für PATCH; leer, wenn nichts geändert wurde. */
export function folderPatch(
  folder: Folder,
  next: { name: string; criterion: FolderCriterion },
): { name?: string; criterion?: FolderCriterion } {
  const patch: { name?: string; criterion?: FolderCriterion } = {};
  if (next.name !== folder.name) patch.name = next.name;
  if (next.criterion.kind !== folder.criterion.kind || next.criterion.id !== folder.criterion.id) {
    patch.criterion = next.criterion;
  }
  return patch;
}
