import { PairingCodeSchema } from "@illusion/schema";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSession } from "../src/store/session";
import { useSettings } from "../src/store/settings";
import { Button, Field, Muted, Screen, StatusText } from "../src/ui/components";

export default function PairScreen() {
  const router = useRouter();
  const { status, pairedCode, pendingCode, error, connect, disconnect } = useSession();
  const lastCode = useSettings((state) => state.lastCode);
  const serverHost = useSettings((state) => state.serverHost);
  const [code, setCode] = useState(lastCode ?? "");

  const normalized = code.trim().toUpperCase();
  const isValid = PairingCodeSchema.safeParse(normalized).success;

  let statusText = "Digite o código exibido no canto da TV.";
  let tone: "muted" | "success" | "danger" = "muted";
  if (pairedCode) {
    statusText = `Pareado com a TV ${pairedCode}.`;
    tone = "success";
  } else if (pendingCode) {
    statusText = status === "open" ? "Aguardando a TV confirmar..." : status === "closed" ? "Sem conexão com o servidor. Tentando de novo..." : "Conectando ao servidor...";
  }
  if (error) {
    statusText = error;
    tone = "danger";
  }

  return (
    <Screen>
      <Field
        label="Código da TV"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="ABC123"
        style={{ fontSize: 28, letterSpacing: 8, textAlign: "center" }}
      />
      <StatusText tone={tone}>{statusText}</StatusText>

      {pairedCode ? (
        <Button title="Pronto" variant="primary" onPress={() => router.back()} />
      ) : (
        <Button title="Conectar" variant="primary" disabled={!isValid || Boolean(pendingCode)} onPress={() => connect(normalized)} />
      )}
      {pendingCode && <Button title="Desconectar" variant="danger" onPress={disconnect} />}

      <Muted>{`Servidor: ${serverHost}`}</Muted>
      <Button title="Alterar servidor" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
