import { useLocalSearchParams } from "expo-router";
import { ChapterReader } from "../../src/screens/ChapterReader";
import { PageReader } from "../../src/screens/PageReader";
import { isbnFromBookPresetId, useLibrary } from "../../src/store/library";
import { Muted, Screen } from "../../src/ui/components";

/** `book-<isbn>` abre o leitor por capítulo (fluxo principal); qualquer outro id é um preset por página. */
export default function ReadScreen() {
  const { presetId } = useLocalSearchParams<{ presetId: string }>();
  const preset = useLibrary((state) => state.presets[presetId]);
  const isbn = isbnFromBookPresetId(presetId);

  if (isbn) return <ChapterReader isbn={isbn} />;
  if (preset) return <PageReader preset={preset} />;
  return (
    <Screen>
      <Muted>Cena não encontrada.</Muted>
    </Screen>
  );
}
