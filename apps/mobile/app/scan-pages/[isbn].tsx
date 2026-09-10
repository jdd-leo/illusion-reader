import type { AnalyzeRequest } from "@illusion/schema";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { analyzePage } from "../../src/api/analyze";
import { shrinkForAnalysis } from "../../src/lib/image";
import { OcrUnavailableError, recognizePage } from "../../src/lib/ocr";
import { aiPresetId, useLibrary } from "../../src/store/library";
import { useSettings } from "../../src/store/settings";
import { Body, Button, Chip, Field, Muted, Row, Screen, SectionTitle } from "../../src/ui/components";
import { colors } from "../../src/ui/theme";

type ItemStatus = "ocr" | "analyzing" | "done" | "error";

interface ScanItem {
  id: string;
  uri: string;
  page: number;
  status: ItemStatus;
  via: "texto" | "imagem" | null;
  summary?: string;
  motion?: string;
  error?: string;
}

/** OCR com menos texto que isto costuma ser página ilegível ou foto ruim; a imagem vai inteira. */
const MIN_TEXT_CHARS = 80;
const MAX_CONCURRENT_ANALYSES = 3;

export default function ScanPagesScreen() {
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const book = useLibrary((state) => state.books[isbn]);
  const aiPreset = useLibrary((state) => state.presets[aiPresetId(isbn)]);
  const upsertAiPage = useLibrary((state) => state.upsertAiPage);
  const moveAiPage = useLibrary((state) => state.moveAiPage);
  const serverHost = useSettings((state) => state.serverHost);
  const [permission, requestPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView>(null);
  const inFlight = useRef(0);
  /** Página corrente de cada foto, inclusive correções digitadas durante a análise. */
  const pageOf = useRef(new Map<string, number>());
  const [items, setItems] = useState<ScanItem[]>([]);
  const [nextPage, setNextPage] = useState(String((aiPreset?.pages.at(-1)?.page ?? 0) + 1));
  const [capturing, setCapturing] = useState(false);

  const update = (id: string, patch: Partial<ScanItem>) => setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  function setItemPage(item: ScanItem, page: number): void {
    pageOf.current.set(item.id, page);
    update(item.id, { page });
  }

  /** Correção manual pelo usuário: renumera no preset se a cena já foi salva. */
  function commitPageEdit(item: ScanItem, raw: string): void {
    const page = Number(raw);
    if (!Number.isInteger(page) || page < 1 || page === item.page || !book) return;
    if (item.status === "done") moveAiPage(book.isbn13, item.page, page);
    setItemPage(item, page);
  }

  async function capture(): Promise<void> {
    if (!cameraRef.current || capturing || !book) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo) return;
      const fallbackPage = Math.max(1, Number(nextPage) || 1);
      const item: ScanItem = { id: `${Date.now()}`, uri: photo.uri, page: fallbackPage, status: "ocr", via: null };
      pageOf.current.set(item.id, fallbackPage);
      setItems((list) => [item, ...list]);
      setNextPage(String(fallbackPage + 1));
      void process(item);
    } finally {
      setCapturing(false);
    }
  }

  async function process(item: ScanItem): Promise<void> {
    if (!book) return;
    let request: AnalyzeRequest;
    try {
      const ocr = await recognizePage(item.uri);
      if (ocr.pageNumber && ocr.pageNumber !== pageOf.current.get(item.id)) {
        setItemPage(item, ocr.pageNumber);
        setNextPage(String(ocr.pageNumber + 1));
      }
      if (ocr.text.length >= MIN_TEXT_CHARS) {
        request = { isbn13: book.isbn13, text: ocr.text };
        update(item.id, { status: "analyzing", via: "texto" });
      } else {
        request = await imageRequest(item);
      }
    } catch (error) {
      if (!(error instanceof OcrUnavailableError)) {
        update(item.id, { status: "error", error: `OCR falhou: ${error instanceof Error ? error.message : "erro"}` });
        return;
      }
      try {
        request = await imageRequest(item);
      } catch (imageError) {
        update(item.id, { status: "error", error: imageError instanceof Error ? imageError.message : "falha ao preparar a imagem" });
        return;
      }
    }

    await waitForSlot();
    try {
      const result = await analyzePage(serverHost, request);
      const page = pageOf.current.get(item.id) ?? item.page;
      upsertAiPage(book.isbn13, book.title, { ...result.page, page });
      update(item.id, { status: "done", summary: result.summary, motion: result.page.visual.motion });
    } catch (error) {
      update(item.id, { status: "error", error: error instanceof Error ? error.message : "falha na análise" });
    } finally {
      inFlight.current--;
    }
  }

  async function imageRequest(item: ScanItem): Promise<AnalyzeRequest> {
    if (!book) throw new Error("livro não encontrado");
    update(item.id, { status: "analyzing", via: "imagem" });
    const image = await shrinkForAnalysis(item.uri);
    return { isbn13: book.isbn13, image: { mediaType: "image/jpeg", data: image.base64 } };
  }

  async function waitForSlot(): Promise<void> {
    while (inFlight.current >= MAX_CONCURRENT_ANALYSES) await new Promise((resolve) => setTimeout(resolve, 250));
    inFlight.current++;
  }

  if (!book) {
    return (
      <Screen>
        <Muted>Livro não encontrado.</Muted>
      </Screen>
    );
  }

  const pending = items.filter((item) => item.status === "ocr" || item.status === "analyzing").length;
  const done = items.filter((item) => item.status === "done").length;

  return (
    <Screen>
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View style={styles.shutterBar} pointerEvents="box-none">
              <Pressable
                onPress={() => void capture()}
                disabled={capturing}
                style={({ pressed }) => [styles.shutter, (pressed || capturing) && styles.shutterPressed]}
                accessibilityLabel="Fotografar página"
              />
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <Muted>Enquadre a página inteira, com boa luz e sem sombra.</Muted>
            <Button title="Permitir câmera" variant="primary" onPress={() => void requestPermission()} />
          </View>
        )}
      </View>

      <Row>
        <View style={styles.grow}>
          <Field label="Página da próxima foto" value={nextPage} onChangeText={setNextPage} keyboardType="number-pad" />
        </View>
        <Chip tone="accent">{`${aiPreset?.pages.length ?? 0} cenas`}</Chip>
      </Row>
      <Muted>O número impresso na página, quando lido, corrige o campo sozinho. Se errar, toque no número da foto e digite o certo.</Muted>

      {items.length > 0 && <SectionTitle>Fotos desta sessão</SectionTitle>}
      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
          <View style={styles.grow}>
            <Row>
              <Text style={styles.pageLabel}>pág.</Text>
              <TextInput
                key={`${item.id}-${item.page}`}
                defaultValue={String(item.page)}
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.pageInput}
                onEndEditing={(event) => commitPageEdit(item, event.nativeEvent.text)}
              />
              {item.status === "ocr" && <Chip tone="info">lendo texto</Chip>}
              {item.status === "analyzing" && <Chip tone="info">{`analisando via ${item.via}`}</Chip>}
              {item.status === "done" && <Chip tone="success">{`${item.motion} · ${item.via}`}</Chip>}
              {item.status === "error" && <Chip tone="danger">erro</Chip>}
            </Row>
            {item.summary && <Muted>{item.summary}</Muted>}
            {item.error && <Text style={styles.error}>{item.error}</Text>}
          </View>
        </View>
      ))}

      <Button title={pending > 0 ? `Aguardando ${pending} análise(s)...` : done > 0 ? "Concluir" : "Voltar"} variant={pending > 0 ? "secondary" : "primary"} onPress={() => router.back()} disabled={pending > 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: 400, borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface },
  camera: { flex: 1 },
  permission: { flex: 1, justifyContent: "center", padding: 16, gap: 12 },
  shutterBar: { position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 5, borderColor: "rgba(0,0,0,0.35)" },
  shutterPressed: { transform: [{ scale: 0.9 }], backgroundColor: colors.accent },
  grow: { flex: 1 },
  item: { flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 12 },
  thumb: { width: 56, height: 76, borderRadius: 8, backgroundColor: colors.border },
  pageLabel: { color: colors.muted, fontSize: 14 },
  pageInput: { color: colors.text, fontSize: 18, fontWeight: "600", minWidth: 56, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, textAlign: "center" },
  error: { color: colors.danger, fontSize: 13 },
});
