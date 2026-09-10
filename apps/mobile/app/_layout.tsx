import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../src/ui/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Biblioteca" }} />
        <Stack.Screen name="scan-isbn" options={{ title: "Adicionar livro" }} />
        <Stack.Screen name="pair" options={{ title: "Conectar à TV" }} />
        <Stack.Screen name="settings" options={{ title: "Servidor" }} />
        <Stack.Screen name="book/[isbn]" options={{ title: "Livro" }} />
        <Stack.Screen name="scan-pages/[isbn]" options={{ title: "Escanear páginas" }} />
        <Stack.Screen name="read/[presetId]" options={{ title: "Leitura" }} />
      </Stack>
    </>
  );
}
