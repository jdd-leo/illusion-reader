import { useState } from "react";
import { apiUrl } from "../src/api/config";
import { fetchDevPresets } from "../src/api/presets";
import { useLibrary } from "../src/store/library";
import { useSettings } from "../src/store/settings";
import { Button, Field, Muted, Screen, SectionTitle, StatusText } from "../src/ui/components";

const TEST_TIMEOUT_MS = 4000;

export default function SettingsScreen() {
  const serverHost = useSettings((state) => state.serverHost);
  const setServerHost = useSettings((state) => state.setServerHost);
  const [host, setHost] = useState(serverHost);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const books = useLibrary((state) => state.books);
  const addBook = useLibrary((state) => state.addBook);
  const addPreset = useLibrary((state) => state.addPreset);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ text: string; ok: boolean } | null>(null);

  async function test(): Promise<void> {
    setResult(null);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tempo esgotado")), TEST_TIMEOUT_MS));
    try {
      const response = await Promise.race([fetch(`${apiUrl(host.trim())}/health`), timeout]);
      setResult(response.ok ? { text: "Servidor respondeu.", ok: true } : { text: `Servidor respondeu ${response.status}.`, ok: false });
    } catch (error) {
      setResult({ text: `Sem resposta: ${error instanceof Error ? error.message : "erro"}`, ok: false });
    }
  }

  async function importSamples(): Promise<void> {
    setImporting(true);
    setImportResult(null);
    try {
      const presets = await fetchDevPresets(serverHost);
      for (const preset of presets) {
        if (!books[preset.isbn13]) addBook({ isbn13: preset.isbn13, title: preset.title, authors: [] });
        addPreset(preset);
      }
      const pages = presets.reduce((total, preset) => total + preset.pages.length, 0);
      setImportResult({ text: `${presets.length} cena(s), ${pages} página(s) importadas. Veja na biblioteca.`, ok: true });
    } catch (error) {
      setImportResult({ text: `Falha ao importar: ${error instanceof Error ? error.message : "erro"}`, ok: false });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Screen>
      <Field label="Endereço do servidor (ip:porta)" value={host} onChangeText={setHost} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="192.168.0.10:8787" />
      <Muted>É a máquina onde a API e o relay estão rodando. Em desenvolvimento, o padrão é o IP do computador que serve o app.</Muted>
      <Button title="Testar conexão" onPress={() => void test()} />
      {result && <StatusText tone={result.ok ? "success" : "danger"}>{result.text}</StatusText>}
      <Button
        title="Salvar"
        variant="primary"
        disabled={host.trim() === serverHost}
        onPress={() => {
          setServerHost(host);
          setResult({ text: "Salvo. Reconecte à TV para usar o novo endereço.", ok: true });
        }}
      />
      <SectionTitle>Desenvolvimento</SectionTitle>
      <Muted>Importa o preset gerado no servidor por npm run test:analyze, sem precisar escanear páginas.</Muted>
      <Button title={importing ? "Importando..." : "Importar amostras do servidor"} disabled={importing} onPress={() => void importSamples()} />
      {importResult && <StatusText tone={importResult.ok ? "success" : "danger"}>{importResult.text}</StatusText>}
    </Screen>
  );
}
