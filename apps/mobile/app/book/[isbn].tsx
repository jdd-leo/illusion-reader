import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { bookPresetId, pagePresetsForBook, useLibrary } from "../../src/store/library";
import { usePreparation } from "../../src/store/preparation";
import { useSettings } from "../../src/store/settings";
import { Body, Button, Card, Chip, Cover, Muted, Row, Screen, SectionTitle, StatusText, Title } from "../../src/ui/components";

export default function BookScreen() {
  const router = useRouter();
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  const book = useLibrary((state) => state.books[isbn]);
  const chapterPreset = useLibrary((state) => state.presets[bookPresetId(isbn)]);
  const progress = useLibrary((state) => state.progress[isbn]);
  // Selecionar um objeto estável e filtrar fora do seletor: um array novo por render faria o zustand entrar em loop.
  const allPresets = useLibrary((state) => state.presets);
  const pagePresets = pagePresetsForBook(allPresets, isbn);
  const removePreset = useLibrary((state) => state.removePreset);
  const removeBook = useLibrary((state) => state.removeBook);
  const job = usePreparation((state) => state.jobs[isbn]);
  const dismissError = usePreparation((state) => state.dismissError);
  const advancedMode = useSettings((state) => state.advancedMode);

  if (!book) {
    return (
      <Screen>
        <Muted>Livro não encontrado.</Muted>
      </Screen>
    );
  }

  const details = [book.publisher, book.publishedDate?.slice(0, 4), book.pageCount ? `${book.pageCount} páginas` : null].filter(Boolean).join(" · ");
  const readPath = `/read/${bookPresetId(book.isbn13)}`;

  return (
    <Screen>
      <Row>
        <Cover uri={book.thumbnail} title={book.title} size={80} />
        <View style={styles.grow}>
          <Title>{book.title}</Title>
          <Muted>{book.authors.join(", ") || "autor desconhecido"}</Muted>
          {details.length > 0 && <Muted>{details}</Muted>}
        </View>
      </Row>

      {chapterPreset ? (
        <>
          <Card>
            <Body>Ambiente pronto</Body>
            <Muted>{progress ? `Você parou no capítulo ${progress.chapterIndex} de ${chapterPreset.chapters.length}.` : `${chapterPreset.chapters.length} capítulos.`}</Muted>
          </Card>
          <Button title={progress ? "Continuar leitura" : "Ler"} variant="primary" big onPress={() => router.push(readPath)} />
          <Button title="Fotografar o sumário de novo" onPress={() => router.push(`/toc/${book.isbn13}`)} />
        </>
      ) : job?.status === "running" ? (
        <>
          <Card>
            <Body>Preparando o ambiente...</Body>
            <Muted>Leva cerca de um minuto. Você já pode começar a ler.</Muted>
          </Card>
          <Button title="Ler" variant="primary" big onPress={() => router.push(readPath)} />
        </>
      ) : (
        <>
          {job?.status === "error" && <StatusText tone="danger">{`Não consegui preparar o ambiente: ${job.error ?? "erro"}.`}</StatusText>}
          <Button
            title={job?.status === "error" ? "Tentar de novo" : "Preparar ambiente"}
            variant="primary"
            big
            onPress={() => {
              dismissError(book.isbn13);
              router.push(`/toc/${book.isbn13}`);
            }}
          />
          <Muted>Uma foto do sumário e o livro inteiro fica pronto para ler com a TV.</Muted>
        </>
      )}

      {advancedMode && (
        <>
          <SectionTitle>Cena por página (avançado)</SectionTitle>
          <Button title="Fotografar páginas" onPress={() => router.push(`/scan-pages/${book.isbn13}`)} />
          {pagePresets.map((preset) => (
            <Card key={preset.id}>
              <Row>
                <View style={styles.grow}>
                  <Body>{preset.title}</Body>
                  <Muted>{`${preset.pages.length} página(s) · ${preset.pages[0]?.page ?? "?"} a ${preset.pages.at(-1)?.page ?? "?"}`}</Muted>
                </View>
                <Chip tone="muted">{preset.source}</Chip>
              </Row>
              <Row>
                <Button title="Ler" variant="primary" grow onPress={() => router.push(`/read/${preset.id}`)} />
                <Button title="Remover" variant="danger" onPress={() => removePreset(preset.id)} />
              </Row>
            </Card>
          ))}
        </>
      )}

      <View style={styles.grow} />
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
