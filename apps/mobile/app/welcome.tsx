import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSettings } from "../src/store/settings";
import { Button, Card, Muted, Screen } from "../src/ui/components";
import { colors } from "../src/ui/theme";

const STEPS = [
  { number: "1", text: "Escaneie o livro e fotografe o sumário. Só uma vez." },
  { number: "2", text: "Abra o endereço que aparece no app na sua TV e digite o código." },
  { number: "3", text: "Leia. A cada capítulo, um toque. O resto acontece sozinho." },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const setOnboardingDone = useSettings((state) => state.setOnboardingDone);

  function done(): void {
    setOnboardingDone();
    router.replace("/");
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Illusion Reader</Text>
        <Muted>Luz e som que acompanham a sua leitura, sem tirar os olhos do livro.</Muted>
      </View>
      {STEPS.map((step) => (
        <Card key={step.number}>
          <View style={styles.step}>
            <Text style={styles.number}>{step.number}</Text>
            <Text style={styles.text}>{step.text}</Text>
          </View>
        </Card>
      ))}
      <View style={styles.grow} />
      <Button title="Começar" variant="primary" big onPress={done} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, paddingVertical: 24 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  step: { flexDirection: "row", gap: 16, alignItems: "center" },
  number: { color: colors.accent, fontSize: 28, fontWeight: "700", width: 28 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22, flex: 1 },
  grow: { flex: 1 },
});
