import { PresetSchema, type Preset } from "@illusion/schema";
import { useLocalSearchParams, useRouter } from "expo-router";
import samplePreset from "../../../receiver/fixtures/sample-preset.json";
import { presetsForBook, useLibrary } from "../../src/store/library";
import { StyleSheet, View } from "react-native";
import { Body, Button, Card, Chip, Cover, Muted, Row, Screen, SectionTitle, Title } from "../../src/ui/components";

const SOURCE_LABEL: Record<Preset["source"], string> = {
  ai: "gerada por IA",
  manual: "manual",
  official: "oficial",
  community: "comunidade",
};

export default function BookScreen() {
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const book = useLibrary((state) => state.books[isbn]);
  // Selecionar um objeto estável e filtrar fora do seletor: um array novo por render faria o zustand entrar em loop.
  const allPresets = useLibrary((state) => state.presets);
  const presets = presetsForBook(allPresets, isbn);
  const addPreset = useLibrary((state) => state.addPreset);
  const removePreset = useLibrary((state) => state.removePreset);
  const removeBook = useLibrary((state) => state.removeBook);

  if (!book) {
    return (
      <Screen>
        <Muted>Livro não encontrado.</Muted>
      </Screen>
    );
  }

  const details = [book.publisher, book.publishedDate?.slice(0, 4), book.pageCount ? `${book.pageCount} páginas` : null].filter(Boolean).join(" · ");

  function addSampleScene(): void {
    if (!book) return;
    addPreset({ ...PresetSchema.parse(samplePreset), id: `sample-${book.isbn13}`, isbn13: book.isbn13, title: `${book.title} (teste)` });
  }

  return (
    <Screen>
      <Row>
        <Cover uri={book.thumbnail} title={book.title} size={80} />
        <View style={styles.grow}>
          <Title>{book.title}</Title>
          <Muted>{book.authors.join(", ") || "autor desconhecido"}</Muted>
          {details.length > 0 && <Muted>{details}</Muted>}
          <Muted>{`ISBN ${book.isbn13}`}</Muted>
        </View>
      </Row>

      <Button title="Escanear páginas" variant="primary" onPress={() => router.push(`/scan-pages/${book.isbn13}`)} />
      <Muted>Fotografe as páginas que vai ler agora. Cada uma vira uma cena na coleção gerada por IA deste livro.</Muted>

      <SectionTitle>Cenas</SectionTitle>
      {presets.length === 0 && <Muted>Nenhuma cena para esta edição ainda.</Muted>}
      {presets.map((preset) => (
        <Card key={preset.id}>
          <Row>
            <View style={styles.grow}>
              <Body>{preset.title}</Body>
              <Muted>{`${preset.pages.length} página(s) · ${preset.pages[0]?.page ?? "?"} a ${preset.pages.at(-1)?.page ?? "?"}`}</Muted>
            </View>
            <Chip tone={preset.source === "ai" ? "info" : "muted"}>{SOURCE_LABEL[preset.source]}</Chip>
          </Row>
          <Row>
            <Button title="Ler" variant="primary" grow onPress={() => router.push(`/read/${preset.id}`)} />
            <Button title="Remover" variant="danger" onPress={() => removePreset(preset.id)} />
          </Row>
        </Card>
      ))}

      {__DEV__ && <Button title="Usar cena de testes" onPress={addSampleScene} />}

      <Button
        title="Remover livro"
        variant="danger"
        onPress={() => {
          removeBook(book.isbn13);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ grow: { flex: 1 } });
