import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, PaperlessDocument, Tag } from "@papaerless/shared-types";
import { colors } from "@papaerless/ui/src/tokens";
import { api } from "../lib/api";

interface Props {
  documentId: number;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  onBack: () => void;
  onSaved: (doc: PaperlessDocument) => void;
}

/** Einzelauswahl per Chips (ohne Extra-Dependency); erneutes Tippen hebt die Auswahl auf. */
function ChipPicker({
  options,
  value,
  onChange,
}: {
  options: { id: number; name: string }[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <TouchableOpacity
            key={o.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active ? null : o.id)}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function DocumentDetailScreen({ documentId, tags, correspondents, documentTypes, onBack, onSaved }: Props) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PaperlessDocument | null>(null);
  const [title, setTitle] = useState("");
  const [correspondent, setCorrespondent] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setDoc(null);
    setLoadError(null);
    api
      .getDocument(documentId)
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
        setCorrespondent(d.correspondent);
        setDocumentType(d.documentType);
        setSelectedTags(d.tags);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : t("documentDetailScreen.loadFailed")));
  }, [documentId, t]);

  useEffect(load, [load]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await api.updateDocument(documentId, {
        title,
        correspondent,
        documentType,
        tags: selectedTags,
      });
      setDoc(updated);
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("documentDetailScreen.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  function toggleTag(id: number) {
    setSaved(false);
    setSelectedTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const backButton = (
    <TouchableOpacity onPress={onBack} style={styles.back}>
      <Text style={styles.backText}>‹ {t("documentDetailScreen.back")}</Text>
    </TouchableOpacity>
  );

  if (loadError) {
    return (
      <View style={styles.container}>
        {backButton}
        <Text style={styles.muted}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>{t("documentDetailScreen.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!doc) {
    return (
      <View style={styles.container}>
        {backButton}
        <Text style={styles.muted}>{t("documentDetailScreen.loading")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {backButton}

      <Text style={styles.label}>{t("documentDetailScreen.titleLabel")}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(v) => {
          setSaved(false);
          setTitle(v);
        }}
      />

      <Text style={styles.label}>{t("documentDetailScreen.correspondentLabel")}</Text>
      <ChipPicker
        options={correspondents}
        value={correspondent}
        onChange={(id) => {
          setSaved(false);
          setCorrespondent(id);
        }}
      />

      <Text style={styles.label}>{t("documentDetailScreen.documentTypeLabel")}</Text>
      <ChipPicker
        options={documentTypes}
        value={documentType}
        onChange={(id) => {
          setSaved(false);
          setDocumentType(id);
        }}
      />

      <Text style={styles.label}>{t("documentDetailScreen.tagsLabel")}</Text>
      <View style={styles.chipRow}>
        {tags.map((tag) => {
          const active = selectedTags.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleTag(tag.id)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>{t("documentDetailScreen.dateLabel")}</Text>
      <Text style={styles.value}>{new Date(doc.created).toLocaleDateString("de-DE")}</Text>
      <Text style={styles.hint}>{t("documentDetailScreen.dateHint")}</Text>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveText}>
          {isSaving ? t("documentDetailScreen.saving") : t("documentDetailScreen.save")}
        </Text>
      </TouchableOpacity>
      {saved && <Text style={styles.hint}>{t("documentDetailScreen.saved")}</Text>}
      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <Text style={styles.label}>{t("documentDetailScreen.contentLabel")}</Text>
      <Text style={styles.content}>{doc.content || t("documentDetailScreen.noContent")}</Text>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  back: { alignSelf: "flex-start", paddingVertical: 6, marginBottom: 8 },
  backText: { color: colors.light.accent, fontWeight: "600", fontSize: 15 },
  muted: { color: "#666", textAlign: "center", marginTop: 40 },
  retryButton: { alignSelf: "center", marginTop: 12 },
  retryText: { color: colors.light.accent, fontWeight: "600" },
  label: { fontWeight: "700", fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  value: { fontSize: 15 },
  hint: { color: "#666", fontSize: 12, marginTop: 4 },
  error: { color: colors.light.danger, fontSize: 13, marginTop: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#ccc", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.light.accent, borderColor: colors.light.accent },
  chipText: { fontSize: 13, color: "#333" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  saveButton: { backgroundColor: colors.light.accent, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: "#fff", fontWeight: "700" },
  content: { color: "#333", fontSize: 13, lineHeight: 19 },
});
