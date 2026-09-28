import { useRef, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
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
        <Text style={styles.hint}>Kamera-Zugriff wird für den Dokumenten-Scan benötigt.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Zugriff erlauben</Text>
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
            <TouchableOpacity
              onPress={() => setPages((current) => current.filter((_, i) => i !== index))}
            >
              <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
          <Text style={styles.primaryButtonText}>Seite scannen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, pages.length === 0 && styles.disabledButton]}
          onPress={handleFinish}
          disabled={pages.length === 0 || isBuilding}
        >
          <Text style={styles.primaryButtonText}>
            {isBuilding ? "Erstellt PDF…" : `Fertig (${pages.length} Seite${pages.length === 1 ? "" : "n"})`}
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
  thumbnail: { width: 56, height: 72, borderRadius: 6, marginRight: 8, borderWidth: 2, borderColor: "#fff" },
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
  primaryButton: { backgroundColor: "#2563eb", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 999 },
  primaryButtonText: { color: "#111", fontWeight: "600" },
  disabledButton: { opacity: 0.4 },
});
