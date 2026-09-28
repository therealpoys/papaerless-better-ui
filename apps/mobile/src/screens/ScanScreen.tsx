import { useRef, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { colors } from "@papaerless/ui/src/tokens";
import { buildPdfFromImages } from "../lib/pdf";
import { uploadQueue } from "../lib/uploadQueue";
import { CropScreen } from "./CropScreen";

interface CapturedPage {
  uri: string;
}

interface RawCapture {
  uri: string;
  width: number;
  height: number;
}

export function ScanScreen({ onUploaded }: { onUploaded: () => void }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [pendingRaw, setPendingRaw] = useState<RawCapture | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  async function handleCapture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (!photo) return;
    setPendingRaw({ uri: photo.uri, width: photo.width, height: photo.height });
  }

  async function handleFinish() {
    if (pages.length === 0) return;
    setIsBuilding(true);
    try {
      const pdfUri = await buildPdfFromImages(pages.map((p) => p.uri));
      await uploadQueue.enqueue(pdfUri, `scan-${new Date().toISOString().slice(0, 19)}.pdf`);
      setPages([]);
      onUploaded();
    } finally {
      setIsBuilding(false);
    }
  }

  function movePage(index: number, direction: -1 | 1) {
    setPages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  if (pendingRaw) {
    return (
      <CropScreen
        uri={pendingRaw.uri}
        imageWidth={pendingRaw.width}
        imageHeight={pendingRaw.height}
        onDone={(croppedUri) => {
          setPages((current) => [...current, { uri: croppedUri }]);
          setPendingRaw(null);
        }}
        onCancel={() => setPendingRaw(null)}
      />
    );
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>{t("scanScreen.cameraPermissionHint")}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>{t("scanScreen.grantAccess")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />

      {pages.length > 0 && (
        <FlatList
          horizontal
          data={pages}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          style={styles.thumbnailRow}
          renderItem={({ item, index }) => (
            <View style={styles.thumbnailWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />
              <Text style={styles.thumbnailPage}>{index + 1}</Text>
              <View style={styles.thumbnailActions}>
                <TouchableOpacity
                  disabled={index === 0}
                  onPress={() => movePage(index, -1)}
                  style={[styles.thumbnailActionButton, index === 0 && styles.thumbnailActionDisabled]}
                >
                  <Text style={styles.thumbnailActionText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPages((current) => current.filter((_, i) => i !== index))}
                  style={styles.thumbnailActionButton}
                >
                  <Text style={styles.thumbnailActionText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={index === pages.length - 1}
                  onPress={() => movePage(index, 1)}
                  style={[
                    styles.thumbnailActionButton,
                    index === pages.length - 1 && styles.thumbnailActionDisabled,
                  ]}
                >
                  <Text style={styles.thumbnailActionText}>▶</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
          <Text style={styles.primaryButtonText}>{t("scanScreen.capturePage")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, pages.length === 0 && styles.disabledButton]}
          onPress={handleFinish}
          disabled={pages.length === 0 || isBuilding}
        >
          <Text style={styles.primaryButtonText}>
            {isBuilding
              ? t("scanScreen.building")
              : t("scanScreen.finish", { count: pages.length, suffix: pages.length === 1 ? "" : "n" })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  hint: { color: "#fff", textAlign: "center", margin: 24 },
  thumbnailRow: { position: "absolute", bottom: 100, left: 0, right: 0, padding: 8 },
  thumbnailWrap: { marginRight: 10, alignItems: "center" },
  thumbnail: { width: 56, height: 72, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
  thumbnailPage: {
    position: "absolute",
    top: 2,
    left: 4,
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 2,
  },
  thumbnailActions: { flexDirection: "row", gap: 4, marginTop: 4 },
  thumbnailActionButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  thumbnailActionDisabled: { opacity: 0.3 },
  thumbnailActionText: { color: "#fff", fontSize: 11 },
  actions: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  captureButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  primaryButton: { backgroundColor: colors.light.accent, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 999 },
  primaryButtonText: { color: "#111", fontWeight: "600" },
  disabledButton: { opacity: 0.4 },
});
