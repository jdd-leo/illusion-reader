import { defaultRelayUrl, RelayClient } from "@illusion/relay-client";
import { PairingCodeSchema, PresetSchema, type Preset, type RelayMessage } from "@illusion/schema";
import samplePreset from "../../receiver/fixtures/sample-preset.json";

const CODE_STORAGE_KEY = "illusion.pairingCode";

// Catálogo local até existir a API de presets.
const presets: Preset[] = [PresetSchema.parse(samplePreset)];

const el = {
  pair: byId<HTMLElement>("pair"),
  code: byId<HTMLInputElement>("code"),
  connect: byId<HTMLButtonElement>("connect"),
  pairStatus: byId<HTMLElement>("pair-status"),
  session: byId<HTMLElement>("session"),
  sessionStatus: byId<HTMLElement>("session-status"),
  preset: byId<HTMLSelectElement>("preset"),
  presetFile: byId<HTMLInputElement>("preset-file"),
  startPage: byId<HTMLInputElement>("start-page"),
  play: byId<HTMLButtonElement>("play"),
  nowPage: byId<HTMLElement>("now-page"),
  nowTitle: byId<HTMLElement>("now-title"),
  prev: byId<HTMLButtonElement>("prev"),
  next: byId<HTMLButtonElement>("next"),
  disconnect: byId<HTMLButtonElement>("disconnect"),
};

function addPresetOption(preset: Preset): void {
  const option = document.createElement("option");
  option.value = String(presets.indexOf(preset));
  option.textContent = `${preset.title} (${preset.pages.length} págs.)`;
  el.preset.append(option);
  el.preset.value = option.value;
}
for (const preset of presets) addPresetOption(preset);

el.presetFile.addEventListener("change", async () => {
  const file = el.presetFile.files?.[0];
  if (!file) return;
  const parsed = PresetSchema.safeParse(await file.text().then(JSON.parse).catch(() => undefined));
  if (!parsed.success) {
    el.sessionStatus.textContent = `Preset inválido: ${parsed.error.issues[0]?.message ?? "JSON malformado"}`;
    return;
  }
  presets.push(parsed.data);
  addPresetOption(parsed.data);
  el.startPage.value = String(parsed.data.pages[0]?.page ?? 1);
  el.sessionStatus.textContent = `Preset "${parsed.data.title}" carregado.`;
});

let relay: RelayClient | null = null;
let pendingCode: string | null = null;

el.code.value = localStorage.getItem(CODE_STORAGE_KEY) ?? "";

el.connect.addEventListener("click", () => {
  const code = PairingCodeSchema.safeParse(el.code.value.trim().toUpperCase());
  if (!code.success) {
    setPairStatus("Código deve ter 6 caracteres.", true);
    return;
  }
  pendingCode = code.data;
  setPairStatus("Conectando...");
  el.connect.disabled = true;

  relay?.dispose();
  relay = new RelayClient({
    url: defaultRelayUrl(import.meta.env.VITE_RELAY_URL as string | undefined),
    onMessage: handleMessage,
    onStatus: (status) => {
      if (status === "open" && pendingCode) relay?.send({ type: "join", code: pendingCode });
      if (status === "closed") setPairStatus("Sem conexão com o relay. Tentando de novo...", true);
    },
  });
});

el.disconnect.addEventListener("click", () => {
  relay?.dispose();
  relay = null;
  pendingCode = null;
  showPairing();
  setPairStatus("");
});

el.play.addEventListener("click", () => {
  const preset = presets[Number(el.preset.value)];
  if (!preset) return;
  const page = Number(el.startPage.value) || 1;
  relay?.send({ type: "load_preset", preset, page });
});
el.prev.addEventListener("click", () => relay?.send({ type: "prev" }));
el.next.addEventListener("click", () => relay?.send({ type: "next" }));

function handleMessage(message: RelayMessage): void {
  switch (message.type) {
    case "joined":
      localStorage.setItem(CODE_STORAGE_KEY, message.code);
      showSession();
      el.sessionStatus.textContent = `Pareado com a TV ${message.code}`;
      return;
    case "peer_left":
      el.sessionStatus.textContent = "A TV desconectou.";
      return;
    case "state":
      el.nowPage.textContent = message.page === null ? "–" : `pág. ${message.page}`;
      el.nowTitle.textContent = message.presetTitle ?? "nenhum preset carregado";
      return;
    case "error":
      setPairStatus(message.message, true);
      el.connect.disabled = false;
      return;
    default:
      return;
  }
}

function showSession(): void {
  el.pair.hidden = true;
  el.session.hidden = false;
}

function showPairing(): void {
  el.pair.hidden = false;
  el.session.hidden = true;
  el.connect.disabled = false;
}

function setPairStatus(text: string, isError = false): void {
  el.pairStatus.textContent = text;
  el.pairStatus.classList.toggle("error", isError);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`elemento #${id} não encontrado`);
  return element as T;
}
