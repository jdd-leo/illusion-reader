import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useSession } from "../src/store/session";
import { colors } from "../src/ui/theme";

export default function RootLayout() {
  const autoConnect = useSession((state) => state.autoConnect);

  // A TV lembrada reconecta sozinha; a tela de código só aparece se falhar.
  useEffect(() => {
    autoConnect();
  }, [autoConnect]);

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
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="scan-isbn" options={{ title: "Qual livro?" }} />
        <Stack.Screen name="pair" options={{ title: "Ligar a TV" }} />
        <Stack.Screen name="settings" options={{ title: "Ajustes" }} />
        <Stack.Screen name="book/[isbn]" options={{ title: "Livro" }} />
        <Stack.Screen name="toc/[isbn]" options={{ title: "Preparar o ambiente" }} />
        <Stack.Screen name="refine/[isbn]" options={{ title: "Melhorar a cena" }} />
        <Stack.Screen name="scan-pages/[isbn]" options={{ title: "Cena por página" }} />
        <Stack.Screen name="read/[presetId]" options={{ title: "Leitura" }} />
      </Stack>
    </>
  );
}
