import { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

interface CropScreenProps {
  uri: string;
  imageWidth: number;
  imageHeight: number;
  onDone: (croppedUri: string) => void;
  onCancel: () => void;
}

const HANDLE_SIZE = 28;
const MIN_CROP = 40;

/**
 * Einfacher, aber echter interaktiver Zuschnitt: zwei Ecken lassen sich per
 * Drag verschieben, das Rechteck dazwischen ist der Ausschnitt. Bewusst ohne
 * zusätzliche Crop-Library gebaut (nur React Native Core + expo-image-manipulator).
 */
export function CropScreen({ uri, imageWidth, imageHeight, onDone, onCancel }: CropScreenProps) {
  const screenWidth = Dimensions.get("window").width - 32;
  const maxHeight = Dimensions.get("window").height * 0.65;

  const scale = Math.min(screenWidth / imageWidth, maxHeight / imageHeight);
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;

  const [topLeft, setTopLeft] = useState({ x: displayWidth * 0.05, y: displayHeight * 0.05 });
  const [bottomRight, setBottomRight] = useState({
    x: displayWidth * 0.95,
    y: displayHeight * 0.95,
  });
  const [isCropping, setIsCropping] = useState(false);

  const topLeftRef = useRef(topLeft);
  const bottomRightRef = useRef(bottomRight);
  topLeftRef.current = topLeft;
  bottomRightRef.current = bottomRight;

  const topLeftResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const start = topLeftRef.current;
          const next = {
            x: clamp(start.x + gesture.dx, 0, bottomRightRef.current.x - MIN_CROP),
            y: clamp(start.y + gesture.dy, 0, bottomRightRef.current.y - MIN_CROP),
          };
          setTopLeft(next);
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const bottomRightResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const start = bottomRightRef.current;
          const next = {
            x: clamp(start.x + gesture.dx, topLeftRef.current.x + MIN_CROP, displayWidth),
            y: clamp(start.y + gesture.dy, topLeftRef.current.y + MIN_CROP, displayHeight),
          };
          setBottomRight(next);
        },
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleApply() {
    setIsCropping(true);
    try {
      const scaleX = imageWidth / displayWidth;
      const scaleY = imageHeight / displayHeight;
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round(topLeft.x * scaleX),
              originY: Math.round(topLeft.y * scaleY),
              width: Math.round((bottomRight.x - topLeft.x) * scaleX),
              height: Math.round((bottomRight.y - topLeft.y) * scaleY),
            },
          },
        ],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 },
      );
      onDone(result.uri);
    } finally {
      setIsCropping(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zuschnitt anpassen</Text>
      <View style={[styles.imageBox, { width: displayWidth, height: displayHeight }]}>
        <Image
          source={{ uri }}
          style={{ width: displayWidth, height: displayHeight }}
          resizeMode="stretch"
        />
        <View
          pointerEvents="none"
          style={[
            styles.cropRect,
            {
              left: topLeft.x,
              top: topLeft.y,
              width: bottomRight.x - topLeft.x,
              height: bottomRight.y - topLeft.y,
            },
          ]}
        />
        <View
          {...topLeftResponder.panHandlers}
          style={[styles.handle, { left: topLeft.x - HANDLE_SIZE / 2, top: topLeft.y - HANDLE_SIZE / 2 }]}
        />
        <View
          {...bottomRightResponder.panHandlers}
          style={[
            styles.handle,
            { left: bottomRight.x - HANDLE_SIZE / 2, top: bottomRight.y - HANDLE_SIZE / 2 },
          ]}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Verwerfen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleApply} disabled={isCropping}>
          <Text style={styles.primaryButtonText}>
            {isCropping ? "Schneidet zu…" : "Übernehmen"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 16, backgroundColor: "#000" },
  title: { color: "#fff", fontSize: 16, marginBottom: 12 },
  imageBox: { position: "relative", backgroundColor: "#111" },
  cropRect: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#2563eb",
    backgroundColor: "rgba(37,99,235,0.15)",
  },
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "#fff",
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  primaryButton: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fff",
  },
  secondaryButtonText: { color: "#fff" },
});
