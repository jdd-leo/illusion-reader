import type { ChapterRefineRequest } from "@illusion/schema";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { refineChapter } from "../../src/api/chapters";
import { shrinkForAnalysis } from "../../src/lib/image";
import { OcrUnavailableError, recognizePage } from "../../src/lib/ocr";
import { bookPresetId, useLibrary } from "../../src/store/library";
import { useSettings } from "../../src/store/settings";
import { Body, Button, Muted, Screen, StatusText } from "../../src/ui/components";
import { colors } from "../../src/ui/theme";

const MIN_TEXT_CHARS = 80;

/** "Melhorar esta cena": uma foto da primeira página do capítulo refaz as cenas dele. Opcional, nunca exigido. */
export default function RefineScreen() {
  const router = useRouter();
  const { isbn, chapter: chapterParam } = useLocalSearchParams<{ isbn: string; chapter?: string }>();
  const chapterIndex = Number(chapterParam);
  const book = useLibrary((state) => state.books[isbn]);
  const preset = useLibrary((state) => state.presets[bookPresetId(isbn)]);
  const replaceChapter = useLibrary((state) => state.replaceChapter);
  const serverHost = useSettings((state) => state.serverHost);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const chapter = preset?.chapters.find((c) => c.index === chapterIndex);

  if (!book || !chapter) {
    return (
      <Screen>
        <Muted>Capítulo não encontrado.</Muted>
      </Screen>
    );
  }

  async function capture(): Promise<void> {
    if (!cameraRef.current || busy || !book || !chapter) return;
    setBusy(true);
    setStatus("Lendo a página...");
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo) return;

      const base: Omit<ChapterRefineRequest, "text" | "image"> = {
        isbn13: book.isbn13,
        title: book.title,
        ...(book.authors[0] ? { author: book.authors.join(", ") } : {}),
        chapter: {
          index: chapter.index,
          ...(chapter.title !== undefined ? { title: chapter.title } : {}),
          ...(chapter.startPage !== undefined ? { startPage: chapter.startPage } : {}),
          ...(chapter.endPage !== undefined ? { endPage: chapter.endPage } : {}),
        },
      };

      let request: ChapterRefineRequest;
      try {
        const ocr = await recognizePage(photo.uri);
        request = ocr.text.length >= MIN_TEXT_CHARS ? { ...base, text: ocr.text } : { ...base, image: await asImage(photo.uri) };
      } catch (error) {
        if (!(error instanceof OcrUnavailableError)) throw error;
        request = { ...base, image: await asImage(photo.uri) };
      }

      setStatus("Ajustando as cenas do capítulo...");
      const result = await refineChapter(serverHost, request);
      replaceChapter(book.isbn13, result.chapter);
      router.back();
    } catch (error) {
      setStatus(`Não deu certo: ${error instanceof Error ? error.message : "erro"}. Tente de novo ou volte.`);
    } finally {
      setBusy(false);
    }
  }

  async function asImage(uri: string): Promise<NonNullable<ChapterRefineRequest["image"]>> {
    const image = await shrinkForAnalysis(uri);
    return { mediaType: "image/jpeg", data: image.base64 };
  }

  return (
    <Screen>
      <Body>{`Fotografe a primeira página do capítulo ${chapter.index}`}</Body>
      <Muted>A abertura do capítulo diz muito sobre o ambiente. As cenas são refeitas com ela.</Muted>
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.shutterBar} pointerEvents="box-none">
              <Pressable onPress={() => void capture()} disabled={busy} style={({ pressed }) => [styles.shutter, (pressed || busy) && styles.shutterPressed]} accessibilityLabel="Fotografar página" />
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <Button title="Permitir câmera" variant="primary" onPress={() => void requestPermission()} />
          </View>
        )}
      </View>
      {status && <StatusText tone={status.startsWith("Não deu certo") ? "danger" : "muted"}>{status}</StatusText>}
      <Button title="Voltar" onPress={() => router.back()} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: 440, borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface },
  camera: { flex: 1 },
  permission: { flex: 1, justifyContent: "center", padding: 16 },
  shutterBar: { position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 5, borderColor: "rgba(0,0,0,0.35)" },
  shutterPressed: { transform: [{ scale: 0.9 }], backgroundColor: colors.accent },
});
