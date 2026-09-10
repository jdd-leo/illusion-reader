import type { ControlMessage } from "@illusion/schema";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLibrary } from "../../src/store/library";
import { useSession } from "../../src/store/session";
import { Body, Button, Card, Chip, Field, Muted, Row, Screen, StatusText, Title } from "../../src/ui/components";
import { colors } from "../../src/ui/theme";

export default function ReadScreen() {
  // A leitura dura horas com o celular ao lado do livro; a tela não pode apagar.
  useKeepAwake();
  const router = useRouter();
  const { presetId } = useLocalSearchParams<{ presetId: string }>();
  const preset = useLibrary((state) => state.presets[presetId]);
  const { pairedCode, tv, error, send } = useSession();

  const pages = preset ? [...preset.pages].map((page) => page.page + preset.pageOffset).sort((a, b) => a - b) : [];
  const [startPage, setStartPage] = useState(String(pages[0] ?? 1));
  const [started, setStarted] = useState(false);

  if (!preset) {
    return (
      <Screen>
        <Muted>Cena não encontrada.</Muted>
      </Screen>
    );
  }

  function play(): void {
    if (!preset) return;
    const page = Number(startPage);
    if (!Number.isInteger(page) || page < 1) return;
    if (send({ type: "load_preset", preset, page })) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStarted(true);
    }
  }

  function turn(message: ControlMessage): void {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send(message);
  }

  const tvPage = tv?.page ?? null;
  const hasScene = tvPage !== null && pages.includes(tvPage);

  return (
    <Screen scroll={false}>
      <Row>
        <View style={styles.grow}>
          <Title>{preset.title}</Title>
          <Muted>{`${pages.length} páginas com cena, da ${pages[0]} à ${pages[pages.length - 1]}`}</Muted>
        </View>
        <Chip tone={pairedCode ? "success" : "danger"} dot>
          {pairedCode ? "TV" : "sem TV"}
        </Chip>
      </Row>

      {!pairedCode && (
        <Card>
          <Body>TV não conectada</Body>
          <Muted>Conecte a TV para as cenas aparecerem enquanto você lê.</Muted>
          <Button title="Conectar TV" variant="primary" onPress={() => router.push("/pair")} />
        </Card>
      )}
      {error && <StatusText tone="danger">{error}</StatusText>}

      {!started ? (
        <Row>
          <View style={styles.grow}>
            <Field label="Página em que você está" value={startPage} onChangeText={setStartPage} keyboardType="number-pad" />
          </View>
          <Button title="Play" variant="primary" big disabled={!pairedCode} onPress={play} />
        </Row>
      ) : (
        <Pressable onPress={() => setStarted(false)} style={styles.reposition}>
          <Muted>Reposicionar leitura</Muted>
        </Pressable>
      )}

      <View style={styles.now}>
        <Text style={styles.nowLabel}>{started ? "cena na TV" : "aguardando play"}</Text>
        <Text style={styles.nowPage}>{tvPage === null ? "–" : tvPage}</Text>
        {started && tvPage !== null && !hasScene && <Muted>mantendo a última cena anterior</Muted>}
      </View>

      <View style={styles.turns}>
        <Pressable disabled={!started} onPress={() => turn({ type: "prev" })} style={({ pressed }) => [styles.turn, styles.prev, !started && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.turnText}>‹</Text>
          <Text style={styles.turnLabel}>anterior</Text>
        </Pressable>
        <Pressable disabled={!started} onPress={() => turn({ type: "next" })} style={({ pressed }) => [styles.turn, styles.next, !started && styles.disabled, pressed && styles.pressed]}>
          <Text style={[styles.turnText, styles.nextText]}>›</Text>
          <Text style={[styles.turnLabel, styles.nextText]}>próxima página</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  reposition: { alignSelf: "center", paddingVertical: 6 },
  now: { alignItems: "center", paddingVertical: 8, gap: 2 },
  nowLabel: { color: colors.muted, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" },
  nowPage: { color: colors.text, fontSize: 72, fontWeight: "700", lineHeight: 80 },
  turns: { flex: 1, flexDirection: "row", gap: 12, minHeight: 160 },
  turn: { borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  prev: { flex: 2 },
  next: { flex: 3, backgroundColor: colors.accent, borderColor: colors.accent },
  turnText: { color: colors.text, fontSize: 56, lineHeight: 60 },
  turnLabel: { color: colors.muted, fontSize: 13 },
  nextText: { color: colors.accentText },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
