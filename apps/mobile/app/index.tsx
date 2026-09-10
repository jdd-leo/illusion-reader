import { PresetSchema } from "@illusion/schema";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import samplePreset from "../../receiver/fixtures/sample-preset.json";
import { presetsForBook, useLibrary } from "../src/store/library";
import { useSession } from "../src/store/session";
import { Body, Button, Card, Chip, Cover, Muted, Row, Screen, SectionTitle } from "../src/ui/components";

const SAMPLE_ISBN = "9780000000000";

export default function LibraryScreen() {
  const router = useRouter();
  const books = useLibrary((state) => state.books);
  const presets = useLibrary((state) => state.presets);
  const addBook = useLibrary((state) => state.addBook);
  const addPreset = useLibrary((state) => state.addPreset);
  const pairedCode = useSession((state) => state.pairedCode);

  const sorted = Object.values(books).sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  function addSampleBook(): void {
    addBook({ isbn13: SAMPLE_ISBN, title: "Cena de testes", authors: ["Illusion Reader"] });
    addPreset({ ...PresetSchema.parse(samplePreset), id: `sample-${SAMPLE_ISBN}`, isbn13: SAMPLE_ISBN });
    router.push(`/book/${SAMPLE_ISBN}`);
  }

  return (
    <Screen>
      <Card onPress={() => router.push("/pair")}>
        <Row>
          <View style={styles.grow}>
            <Body>{pairedCode ? "TV conectada" : "Nenhuma TV conectada"}</Body>
            <Muted>{pairedCode ? `Código ${pairedCode}` : "Toque para digitar o código exibido na TV"}</Muted>
          </View>
          <Chip tone={pairedCode ? "success" : "muted"} dot>
            {pairedCode ? "online" : "offline"}
          </Chip>
        </Row>
      </Card>

      <SectionTitle>Seus livros</SectionTitle>
      {sorted.length === 0 ? (
        <Card>
          <Body>Nenhum livro ainda.</Body>
          <Muted>Escaneie o código de barras do livro que você vai ler para começar.</Muted>
        </Card>
      ) : (
        sorted.map((book) => {
          const scenes = presetsForBook(presets, book.isbn13).reduce((sum, preset) => sum + preset.pages.length, 0);
          return (
            <Card key={book.isbn13} onPress={() => router.push(`/book/${book.isbn13}`)}>
              <Row>
                <Cover uri={book.thumbnail} title={book.title} />
                <View style={styles.grow}>
                  <Body>{book.title}</Body>
                  <Muted>{book.authors.join(", ") || "autor desconhecido"}</Muted>
                  <Muted>{scenes === 0 ? "sem cenas ainda" : `${scenes} página(s) com cena`}</Muted>
                </View>
              </Row>
            </Card>
          );
        })
      )}

      <Button title="Adicionar livro" variant="primary" onPress={() => router.push("/scan-isbn")} />
      <Row>
        <Button title="Servidor" onPress={() => router.push("/settings")} grow />
        {__DEV__ && <Button title="Livro de testes" onPress={addSampleBook} grow />}
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({ grow: { flex: 1 } });
