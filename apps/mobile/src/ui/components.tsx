import { Image } from "expo-image";
import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "./theme";

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, onPress }: PropsWithChildren<{ onPress?: () => void }>) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Row({ children }: PropsWithChildren) {
  return <View style={styles.row}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  big?: boolean;
  disabled?: boolean;
  grow?: boolean;
}

export function Button({ title, onPress, variant = "secondary", big = false, disabled = false, grow = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "danger" && styles.buttonDanger,
        big && styles.buttonBig,
        grow && styles.grow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === "primary" && styles.buttonTextPrimary, big && styles.buttonTextBig]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...input} style={[styles.input, input.style]} />
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.section}>{children}</Text>;
}

type ChipTone = "muted" | "success" | "danger" | "accent" | "info";
const CHIP_COLORS: Record<ChipTone, string> = { muted: colors.muted, success: colors.success, danger: colors.danger, accent: colors.accent, info: "#7aa7e0" };

export function Chip({ children, tone = "muted", dot = false }: PropsWithChildren<{ tone?: ChipTone; dot?: boolean }>) {
  const color = CHIP_COLORS[tone];
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      {dot && <View style={[styles.chipDot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, { color }]}>{children}</Text>
    </View>
  );
}

/** Capa do livro; sem imagem mostra a inicial do título. */
export function Cover({ uri, title, size = 56 }: { uri?: string; title: string; size?: number }) {
  const style = { width: size, height: Math.round(size * 1.45), borderRadius: Math.round(size / 8) };
  if (uri) return <Image source={{ uri }} style={[styles.cover, style]} contentFit="cover" transition={200} />;
  return (
    <View style={[styles.cover, styles.coverEmpty, style]}>
      <Text style={[styles.coverInitial, { fontSize: size / 2 }]}>{title.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function StatusText({ children, tone = "muted" }: PropsWithChildren<{ tone?: "muted" | "danger" | "success" }>) {
  const color = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.muted;
  return <Text style={[styles.muted, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  screenContent: { flex: 1, padding: space(5), gap: space(4) },
  title: { color: colors.text, fontSize: 22, fontWeight: "600" },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: space(4), gap: space(1) },
  row: { flexDirection: "row", gap: space(3), alignItems: "center" },
  grow: { flex: 1 },
  button: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: space(3.5),
    paddingHorizontal: space(4),
    alignItems: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonDanger: { borderColor: colors.danger },
  buttonBig: { paddingVertical: space(7) },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "500" },
  buttonTextPrimary: { color: colors.accentText, fontWeight: "600" },
  buttonTextBig: { fontSize: 20 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  section: { color: colors.muted, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginTop: space(2) },
  chip: { flexDirection: "row", alignItems: "center", gap: space(1.5), alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5) },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "600" },
  cover: { backgroundColor: colors.border },
  coverEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  coverInitial: { color: colors.muted, fontWeight: "600" },
  field: { gap: space(1.5) },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
});
