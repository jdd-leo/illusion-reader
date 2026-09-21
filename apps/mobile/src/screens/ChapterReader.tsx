import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { elapsedAtScene, learnMinutesPerPage, positionForPage, sceneIndexAt } from "../lib/sceneClock";
import { useVolumeButtons } from "../lib/volumeButtons";
import { bookPresetId, useLibrary } from "../store/library";
import { usePreparation } from "../store/preparation";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import { Body, Button, Card, Chip, Field, Muted, Row, Screen, StatusText } from "../ui/components";
import { colors } from "../ui/theme";

/** Abaixo disto a IA não conhecia o trecho; vale convidar a fotografar a primeira página. */
const LOW_CONFIDENCE = 0.5;
const TICK_MS = 1000;

/**
 * Tela de leitura do fluxo principal. Uma ação: próximo capítulo. As cenas dentro do capítulo
 * avançam sozinhas pelo relógio (páginas do capítulo × velocidade de leitura). O relógio para
 * quando o app vai para segundo plano ou o leitor pausa.
 */
export function ChapterReader({ isbn }: { isbn: string }) {
  useKeepAwake();
  const router = useRouter();
  const book = useLibrary((state) => state.books[isbn]);
  const preset = useLibrary((state) => state.presets[bookPresetId(isbn)]);
  const progress = useLibrary((state) => state.progress[isbn]);
  const setProgress = useLibrary((state) => state.setProgress);
  const markSceneWrong = useLibrary((state) => state.markSceneWrong);
  const job = usePreparation((state) => state.jobs[isbn]);
  const minutesPerPage = useSettings((state) => state.minutesPerPage);
  const setMinutesPerPage = useSettings((state) => state.setMinutesPerPage);
  const { pairedCode, error, send } = useSession();

  const chapters = preset?.chapters ?? [];
  const [chapterIndex, setChapterIndex] = useState(progress?.chapterIndex ?? 1);
  const [sceneIndex, setSceneIndex] = useState(progress?.sceneIndex ?? 0);
  const [paused, setPaused] = useState(false);
  const [askingPage, setAskingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  const chapter = chapters.find((c) => c.index === chapterIndex) ?? chapters[0];
  const scene = chapter?.scenes[Math.min(sceneIndex, (chapter?.scenes.length ?? 1) - 1)];
  const position = chapters.findIndex((c) => c.index === chapter?.index);
  const nextChapter = position >= 0 ? chapters[position + 1] : undefined;
  const previousChapter = position > 0 ? chapters[position - 1] : undefined;

  /** Instante em que o capítulo "começou", deslocado para o relógio retomar de onde parou. */
  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef<number | null>(null);
  const autoPaused = useRef(false);

  function pauseClock(): void {
    if (pausedAt.current === null) pausedAt.current = Date.now();
  }
  function resumeClock(): void {
    if (pausedAt.current !== null && startedAt.current !== null) startedAt.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
  }
  function restartClock(elapsedMs: number): void {
    startedAt.current = Date.now() - elapsedMs;
    pausedAt.current = paused ? Date.now() : null;
  }

  // O preset pode chegar depois da tela (geração em segundo plano): o relógio começa quando ele existir.
  useEffect(() => {
    if (!chapter || startedAt.current !== null) return;
    restartClock(elapsedAtScene(chapter, sceneIndex, minutesPerPage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!chapter || startedAt.current === null || pausedAt.current !== null) return;
      const next = sceneIndexAt(chapter, Date.now() - startedAt.current, minutesPerPage);
      if (next !== sceneIndex) setSceneIndex(next);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [chapter, sceneIndex, minutesPerPage]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (autoPaused.current) {
          autoPaused.current = false;
          if (!paused) resumeClock();
        }
      } else if (pausedAt.current === null) {
        autoPaused.current = true;
        pauseClock();
      }
    });
    return () => subscription.remove();
  }, [paused]);

  // Carrega (ou recarrega) o preset na TV na posição atual: ao conectar, ao chegar o preset, ao trocar uma cena.
  useEffect(() => {
    if (!preset || !pairedCode || !chapter) return;
    send({ type: "load_preset", preset, chapter: chapter.index, scene: sceneIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, pairedCode]);

  useEffect(() => {
    if (!chapter || !pairedCode) return;
    send({ type: "goto_scene", chapter: chapter.index, scene: sceneIndex });
    setProgress(isbn, chapter.index, sceneIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.index, sceneIndex]);

  function goToChapter(target: { index: number }, learn: boolean): void {
    if (chapter && learn && startedAt.current !== null) {
      setMinutesPerPage(learnMinutesPerPage(minutesPerPage, chapter, Date.now() - startedAt.current));
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChapterIndex(target.index);
    setSceneIndex(0);
    restartClock(0);
  }

  function advance(): void {
    if (nextChapter) goToChapter(nextChapter, true);
  }

  useVolumeButtons(advance, Boolean(chapter));

  function togglePause(): void {
    if (paused) resumeClock();
    else pauseClock();
    setPaused(!paused);
  }

  function goToPage(): void {
    const page = Number(pageInput);
    if (!Number.isInteger(page) || page < 1) {
      setPageError("Digite o número da página.");
      return;
    }
    const target = positionForPage(chapters, page, minutesPerPage);
    if (!target) {
      setPageError("Este livro não tem páginas no sumário. Use Anterior e Próximo capítulo.");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChapterIndex(target.chapterIndex);
    setSceneIndex(target.sceneIndex);
    restartClock(target.elapsedMs);
    setAskingPage(false);
    setPageInput("");
    setPageError(null);
  }

  function notFitting(): void {
    if (!chapter) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    markSceneWrong(isbn, chapter.index, sceneIndex);
  }

  if (!book) {
    return (
      <Screen>
        <Muted>Livro não encontrado.</Muted>
      </Screen>
    );
  }

  const preparing = job?.status === "running";
  const failed = job?.status === "error";
  const lowConfidence = chapter !== undefined && chapter.confidence < LOW_CONFIDENCE;

  return (
    <Screen scroll={false}>
      <Row>
        <View style={styles.grow}>
          <Muted>{book.title}</Muted>
        </View>
        <Chip tone={pairedCode ? "success" : "danger"} dot>
          {pairedCode ? "TV" : "sem TV"}
        </Chip>
      </Row>

      {!pairedCode && (
        <Card>
          <Body>A TV não está conectada</Body>
          <Muted>Abra o endereço da TV no navegador dela e digite o código aqui.</Muted>
          <Button title="Conectar TV" variant="primary" onPress={() => router.push("/pair")} />
        </Card>
      )}
      {error && <StatusText tone="danger">{error}</StatusText>}

      {!preset && preparing && <StatusText>Preparando o ambiente do livro. Pode começar a ler; as cenas chegam sozinhas.</StatusText>}
      {!preset && failed && (
        <Card>
          <StatusText tone="danger">{`Não consegui preparar o ambiente: ${job.error ?? "erro"}.`}</StatusText>
          <Button title="Tentar de novo" variant="primary" onPress={() => router.replace(`/toc/${isbn}`)} />
        </Card>
      )}
      {!preset && !preparing && !failed && (
        <Card>
          <Body>Este livro ainda não tem ambiente</Body>
          <Button title="Preparar ambiente" variant="primary" onPress={() => router.replace(`/toc/${isbn}`)} />
        </Card>
      )}

      <View style={styles.now}>
        <Text style={styles.nowLabel}>capítulo</Text>
        <Text style={styles.nowNumber}>{chapter?.index ?? "–"}</Text>
        {chapter?.title && <Text style={styles.nowTitle}>{chapter.title}</Text>}
        <Text style={styles.mood}>{scene ? scene.mood.join("  ·  ") : preparing ? "aguardando as cenas" : " "}</Text>
        {paused && <Chip tone="accent">pausado</Chip>}
      </View>

      <Pressable
        disabled={!nextChapter}
        onPress={advance}
        style={({ pressed }) => [styles.next, !nextChapter && styles.disabled, pressed && styles.pressed]}
        accessibilityLabel="Próximo capítulo"
      >
        <Text style={styles.nextText}>{nextChapter ? "Próximo capítulo" : chapter ? "Último capítulo" : "Próximo capítulo"}</Text>
        {nextChapter && <Text style={styles.nextHint}>ou botão de volume</Text>}
      </Pressable>

      <Row>
        <Button title="Anterior" grow disabled={!previousChapter} onPress={() => previousChapter && goToChapter(previousChapter, false)} />
        <Button title={paused ? "Continuar" : "Pausar"} grow disabled={!chapter} onPress={togglePause} />
        <Button title="Não combina" grow disabled={!scene} onPress={notFitting} />
      </Row>
      <Row>
        <Button title="Estou na página..." grow disabled={!chapter} onPress={() => setAskingPage(!askingPage)} />
        {lowConfidence && <Button title="Melhorar esta cena" grow onPress={() => router.push(`/refine/${isbn}?chapter=${chapter.index}`)} />}
      </Row>
      {askingPage && (
        <Row>
          <View style={styles.grow}>
            <Field label="Página" value={pageInput} onChangeText={setPageInput} keyboardType="number-pad" autoFocus />
          </View>
          <Button title="Ir" variant="primary" onPress={goToPage} />
        </Row>
      )}
      {pageError && <StatusText tone="danger">{pageError}</StatusText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  now: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  nowLabel: { color: colors.muted, fontSize: 13, letterSpacing: 2, textTransform: "uppercase" },
  nowNumber: { color: colors.text, fontSize: 88, fontWeight: "700", lineHeight: 96 },
  nowTitle: { color: colors.muted, fontSize: 16, textAlign: "center" },
  mood: { color: colors.accent, fontSize: 20, textAlign: "center", marginTop: 8, minHeight: 28 },
  next: { borderRadius: 20, paddingVertical: 28, alignItems: "center", gap: 2, backgroundColor: colors.accent },
  nextText: { color: colors.accentText, fontSize: 22, fontWeight: "600" },
  nextHint: { color: colors.accentText, fontSize: 12, opacity: 0.7 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
