import type { ChapterOutline } from "@illusion/schema";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { readToc } from "../../src/api/chapters";
import { shrinkForAnalysis } from "../../src/lib/image";
import { bookPresetId, useLibrary } from "../../src/store/library";
import { usePreparation } from "../../src/store/preparation";
import { useSettings } from "../../src/store/settings";
import { Body, Button, Field, Muted, Row, Screen, StatusText } from "../../src/ui/components";
import { colors } from "../../src/ui/theme";

/** O sumário precisa de mais resolução que uma página de texto: números pequenos na margem. */
const TOC_IMAGE_WIDTH = 1400;
const MAX_CHAPTERS = 60;

type Phase = "camera" | "reading" | "confirm" | "count";

interface RowDraft {
  key: number;
  title: string;
  page: string;
}

/**
 * "Preparar o ambiente": uma foto do sumário, confirmação da lista de capítulos e a geração
 * das cenas começa em segundo plano. Sem sumário, o app segue com o clima geral do livro.
 */
export default function TocScreen() {
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const book = useLibrary((state) => state.books[isbn]);
  const serverHost = useSettings((state) => state.serverHost);
  const prepare = usePreparation((state) => state.prepare);
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const nextKey = useRef(1);
  const [phase, setPhase] = useState<Phase>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [chapterCount, setChapterCount] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  if (!book) {
    return (
      <Screen>
        <Muted>Livro não encontrado.</Muted>
      </Screen>
    );
  }

  async function capture(): Promise<void> {
    if (!cameraRef.current || !book) return;
    setStatus(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) return;
      setPhotoUri(photo.uri);
      setPhase("reading");
      const image = await shrinkForAnalysis(photo.uri, TOC_IMAGE_WIDTH);
      const result = await readToc(serverHost, { isbn13: book.isbn13, image: { mediaType: "image/jpeg", data: image.base64 } });
      setRows(result.chapters.map((chapter) => ({ key: nextKey.current++, title: chapter.title ?? "", page: chapter.startPage?.toString() ?? "" })));
      setPhase("confirm");
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro";
      setStatus(message.includes("sumário") ? "Não consegui ler o sumário. Tente com mais luz e a página inteira no quadro." : `Não consegui ler o sumário: ${message}`);
      setPhase("camera");
    }
  }

  function updateRow(key: number, patch: Partial<RowDraft>): void {
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    if (rows.length >= MAX_CHAPTERS) return;
    setRows((list) => [...list, { key: nextKey.current++, title: "", page: "" }]);
  }

  function removeRow(key: number): void {
    setRows((list) => list.filter((row) => row.key !== key));
  }

  function start(chapters: ChapterOutline[]): void {
    if (!book) return;
    void prepare(book, chapters);
    router.replace(`/read/${bookPresetId(book.isbn13)}`);
  }

  function confirmRows(): void {
    const chapters: ChapterOutline[] = rows.map((row, i) => {
      const page = Number(row.page);
      const title = row.title.trim();
      return {
        index: i + 1,
        ...(title ? { title } : {}),
        ...(Number.isInteger(page) && page > 0 ? { startPage: page } : {}),
      };
    });
    if (chapters.length === 0) {
      setStatus("Adicione ao menos um capítulo.");
      return;
    }
    start(chapters);
  }

  function confirmCount(): void {
    const count = Math.min(MAX_CHAPTERS, Math.max(1, Number(chapterCount) || 1));
    start(Array.from({ length: count }, (_, i) => ({ index: i + 1 })));
  }

  if (phase === "reading") {
    return (
      <Screen>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />}
        <Body>Lendo o sumário...</Body>
        <Muted>Leva alguns segundos.</Muted>
      </Screen>
    );
  }

  if (phase === "confirm") {
    return (
      <Screen>
        <Body>Estes são os capítulos?</Body>
        <Muted>Toque para corrigir um título ou uma página. Só a ordem importa de verdade.</Muted>
        {rows.map((row, i) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.index}>{i + 1}</Text>
            <TextInput value={row.title} onChangeText={(title) => updateRow(row.key, { title })} placeholder="Título (opcional)" placeholderTextColor={colors.muted} style={[styles.input, styles.grow]} />
            <TextInput value={row.page} onChangeText={(page) => updateRow(row.key, { page })} placeholder="pág." placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.input, styles.page]} />
            <Pressable onPress={() => removeRow(row.key)} accessibilityLabel="Remover capítulo" style={styles.remove}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        <Button title="Adicionar capítulo" onPress={addRow} disabled={rows.length >= MAX_CHAPTERS} />
        {status && <StatusText tone="danger">{status}</StatusText>}
        <Button title="Está certo" variant="primary" big onPress={confirmRows} />
        <Button
          title="Fotografar de novo"
          onPress={() => {
            setStatus(null);
            setPhase("camera");
          }}
        />
      </Screen>
    );
  }

  if (phase === "count") {
    return (
      <Screen>
        <Body>Sem sumário, tudo bem.</Body>
        <Muted>O ambiente vai seguir o clima geral do livro. Se souber quantos capítulos tem, o app troca de cena a cada capítulo.</Muted>
        <Field label="Quantos capítulos tem o livro? (opcional)" value={chapterCount} onChangeText={setChapterCount} keyboardType="number-pad" placeholder="12" />
        <Button title="Preparar ambiente" variant="primary" big onPress={confirmCount} />
        <Button title="Voltar para a câmera" onPress={() => setPhase("camera")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body>Fotografe o sumário do livro</Body>
      <Muted>A página inteira no quadro, com boa luz. Só uma vez.</Muted>
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.shutterBar} pointerEvents="box-none">
              <Pressable onPress={() => void capture()} style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]} accessibilityLabel="Fotografar sumário" />
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <Button title="Permitir câmera" variant="primary" onPress={() => void requestPermission()} />
          </View>
        )}
      </View>
      {status && <StatusText tone="danger">{status}</StatusText>}
      <Button title="Este livro não tem sumário" onPress={() => setPhase("count")} />
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
  preview: { height: 220, borderRadius: 16, backgroundColor: colors.surface },
  grow: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  index: { color: colors.muted, width: 24, textAlign: "right", fontSize: 14 },
  input: { color: colors.text, fontSize: 15, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  page: { width: 64, textAlign: "center" },
  remove: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  removeText: { color: colors.muted, fontSize: 22, lineHeight: 24 },
});
