import { PresetSchema } from "@illusion/schema";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import sampleChapters from "../../receiver/fixtures/sample-chapters.json";
import { bookPresetId, useLibrary } from "../src/store/library";
import { usePreparation } from "../src/store/preparation";
import { useSession } from "../src/store/session";
import { useSettings } from "../src/store/settings";
import { Body, Button, Card, Chip, Cover, Muted, Row, Screen, SectionTitle } from "../src/ui/components";

const SAMPLE_ISBN = "9780000000002";

export default function LibraryScreen() {
  const router = useRouter();
  const books = useLibrary((state) => state.books);
  const presets = useLibrary((state) => state.presets);
  const progress = useLibrary((state) => state.progress);
  const addBook = useLibrary((state) => state.addBook);
  const addPreset = useLibrary((state) => state.addPreset);
  const jobs = usePreparation((state) => state.jobs);
  const pairedCode = useSession((state) => state.pairedCode);
  const onboardingDone = useSettings((state) => state.onboardingDone);

  useEffect(() => {
    if (!onboardingDone) router.replace("/welcome");
  }, [onboardingDone, router]);

  const sorted = Object.values(books).sort((a, b) => {
    const lastA = progress[a.isbn13]?.updatedAt ?? a.addedAt;
    const lastB = progress[b.isbn13]?.updatedAt ?? b.addedAt;
    return lastB.localeCompare(lastA);
  });

  function addSampleBook(): void {
    addBook({ isbn13: SAMPLE_ISBN, title: "Livro de exemplo em capítulos", authors: ["Illusion Reader"] });
    addPreset({ ...PresetSchema.parse(sampleChapters), id: bookPresetId(SAMPLE_ISBN), isbn13: SAMPLE_ISBN });
    router.push(`/book/${SAMPLE_ISBN}`);
  }

  function statusFor(isbn13: string): string {
    const preset = presets[bookPresetId(isbn13)];
    const current = progress[isbn13];
    if (jobs[isbn13]?.status === "running") return "preparando o ambiente...";
    if (jobs[isbn13]?.status === "error") return "não foi possível preparar";
    if (!preset) return "toque para preparar o ambiente";
    if (current) return `Capítulo ${current.chapterIndex} de ${preset.chapters.length}`;
    return `pronto para ler · ${preset.chapters.length} capítulos`;
  }

  return (
    <Screen>
      <Card onPress={() => router.push("/pair")}>
        <Row>
          <View style={styles.grow}>
            <Body>{pairedCode ? "TV conectada" : "TV desligada"}</Body>
            <Muted>{pairedCode ? "Pronta para acompanhar a leitura" : "Toque para ligar a TV"}</Muted>
          </View>
          <Chip tone={pairedCode ? "success" : "muted"} dot>
            {pairedCode ? "online" : "offline"}
          </Chip>
        </Row>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <Body>Qual livro você vai ler?</Body>
          <Muted>Adicione o livro pelo código de barras. Depois, uma foto do sumário e o ambiente fica pronto.</Muted>
        </Card>
      ) : (
        <>
          <SectionTitle>Seus livros</SectionTitle>
          {sorted.map((book) => (
            <Card key={book.isbn13} onPress={() => router.push(`/book/${book.isbn13}`)}>
              <Row>
                <Cover uri={book.thumbnail} title={book.title} />
                <View style={styles.grow}>
                  <Body>{book.title}</Body>
                  <Muted>{book.authors.join(", ") || "autor desconhecido"}</Muted>
                  <Muted>{statusFor(book.isbn13)}</Muted>
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}

      <Button title="Adicionar livro" variant="primary" big onPress={() => router.push("/scan-isbn")} />
      <Row>
        <Button title="Ajustes" onPress={() => router.push("/settings")} grow />
        {__DEV__ && <Button title="Livro de exemplo" onPress={addSampleBook} grow />}
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({ grow: { flex: 1 } });
