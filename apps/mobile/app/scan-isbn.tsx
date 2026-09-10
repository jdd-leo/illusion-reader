import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { lookupIsbn } from "../src/api/books";
import { normalizeIsbn13 } from "../src/lib/isbn";
import { useLibrary } from "../src/store/library";
import { Body, Button, Field, Muted, Screen, StatusText } from "../src/ui/components";
import { colors } from "../src/ui/theme";

export default function ScanIsbnScreen() {
  const router = useRouter();
  const addBook = useLibrary((state) => state.addBook);
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  /**
   * A câmera emite leituras várias vezes por segundo enquanto o código está em quadro.
   * Depois da primeira leitura válida o scanner trava até o usuário pedir outra, então
   * cada código gera exatamente uma busca, mesmo que ela falhe.
   */
  const [locked, setLocked] = useState(false);
  const busy = useRef(false);

  async function handleIsbn(raw: string): Promise<void> {
    if (busy.current) return;
    const isbn = normalizeIsbn13(raw);
    if (!isbn) {
      setStatus("Código lido não é um ISBN válido.");
      setLocked(true);
      return;
    }
    busy.current = true;
    setLocked(true);
    setStatus(`Buscando ${isbn}...`);
    try {
      const info = await lookupIsbn(isbn);
      if (info) {
        addBook(info);
        router.replace(`/book/${isbn}`);
        return;
      }
      setNotFound(isbn);
      setStatus(null);
    } catch (error) {
      setStatus(`Falha na busca: ${error instanceof Error ? error.message : "erro"}. Toque em "Ler outro código" para tentar de novo.`);
    } finally {
      busy.current = false;
    }
  }

  function unlock(): void {
    setLocked(false);
    setStatus(null);
  }

  function saveManually(): void {
    if (!notFound || title.trim().length === 0) return;
    addBook({
      isbn13: notFound,
      title: title.trim(),
      authors: authors
        .split(",")
        .map((author) => author.trim())
        .filter(Boolean),
    });
    router.replace(`/book/${notFound}`);
  }

  if (notFound) {
    return (
      <Screen>
        <Body>{`ISBN ${notFound} não encontrado.`}</Body>
        <Muted>Preencha os dados da edição para continuar.</Muted>
        <Field label="Título" value={title} onChangeText={setTitle} placeholder="Título do livro" />
        <Field label="Autores (separados por vírgula)" value={authors} onChangeText={setAuthors} />
        <Button title="Salvar" variant="primary" disabled={title.trim().length === 0} onPress={saveManually} />
        <Button
          title="Tentar outro código"
          onPress={() => {
            setNotFound(null);
            unlock();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13"] }}
            onBarcodeScanned={locked ? undefined : (result) => void handleIsbn(result.data)}
          />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <Muted>Aponte a câmera para o código de barras do livro.</Muted>
          <Button title="Permitir câmera" variant="primary" onPress={() => void requestPermission()} />
        </View>
      )}
      {status && <StatusText>{status}</StatusText>}
      {locked && !busy.current && <Button title="Ler outro código" onPress={unlock} />}

      <Field label="Ou digite o ISBN" value={manual} onChangeText={setManual} keyboardType="number-pad" placeholder="9788595084742" />
      <Button title="Buscar" onPress={() => void handleIsbn(manual)} disabled={manual.trim().length < 10 || busy.current} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: 300, borderRadius: 14, overflow: "hidden", backgroundColor: colors.surface, justifyContent: "center", padding: 16, gap: 12 },
  camera: { flex: 1 },
});
