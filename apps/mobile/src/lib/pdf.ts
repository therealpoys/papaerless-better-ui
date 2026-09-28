import * as FileSystem from "expo-file-system";
import { PDFDocument } from "pdf-lib";

/**
 * Baut aus mehreren JPEG-Seiten (Kamera-Aufnahmen, bereits zugeschnitten) ein
 * einzelnes mehrseitiges PDF und schreibt es ins Cache-Verzeichnis.
 * Gibt die lokale file://-URI des PDFs zurück.
 */
export async function buildPdfFromImages(imageUris: string[]): Promise<string> {
  const pdfDoc = await PDFDocument.create();

  for (const uri of imageUris) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const image = await pdfDoc.embedJpg(base64);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const base64Pdf = await pdfDoc.saveAsBase64();
  const outputUri = `${FileSystem.cacheDirectory}scan-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outputUri, base64Pdf, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
}
