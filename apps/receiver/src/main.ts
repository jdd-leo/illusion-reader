import { defaultRelayUrl, RelayClient } from "@illusion/relay-client";
import { PresetSchema, type RelayMessage } from "@illusion/schema";
import sampleChapters from "../fixtures/sample-chapters.json";
import sample from "../fixtures/sample-preset.json";
import { Mixer } from "./audio/mixer";
import { Hud } from "./hud";
import { Player, type Cue } from "./player";
import { Renderer } from "./visual/renderer";

// Receptor (TV/projetor). Controlado pelo celular via relay; o teclado continua disponível para testes.
//   → / espaço / PageDown  próxima página
//   ← / PageUp             página anterior
//   Home                   primeira página
//   1..9                   pula direto para a N-ésima cena do preset
//   L                      carrega o preset de exemplo por página (sem celular)
//   K                      carrega o preset de exemplo por capítulo (sem celular)

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("canvas #scene não encontrado");

const renderer = new Renderer(canvas);
const mixer = new Mixer();
const hud = new Hud();

const player = new Player((cue) => {
  mixer.setLayers(cue?.sound ?? [], cue?.transitionSeconds ?? 4);
  hud.showCue(player.title, cue);
  sendState();
});

let pairingCode: string | null = null;
let controllers = 0;

const relay = new RelayClient({
  url: defaultRelayUrl(import.meta.env.VITE_RELAY_URL as string | undefined),
  onMessage: handleMessage,
  onStatus: (status) => {
    if (status === "open") relay.send({ type: "register" });
    if (status === "closed") {
      pairingCode = null;
      controllers = 0;
      hud.showCode(null);
    }
  },
});
hud.showCode(null);

function handleMessage(message: RelayMessage): void {
  switch (message.type) {
    case "registered":
      pairingCode = message.code;
      if (controllers === 0) hud.showCode(pairingCode);
      return;
    case "peer_joined":
      controllers++;
      hud.hideCode();
      sendState();
      return;
    case "peer_left":
      controllers = Math.max(0, controllers - 1);
      if (controllers === 0) hud.showCode(pairingCode);
      return;
    case "load_preset":
      player.load(message.preset, { chapter: message.chapter, scene: message.scene, page: message.page });
      return;
    case "goto_scene":
      player.goToScene(message.chapter, message.scene);
      return;
    case "goto":
      player.goToPage(message.page);
      return;
    case "next":
      player.next();
      return;
    case "prev":
      player.previous();
      return;
    case "error":
      console.warn("[relay]", message.message);
      return;
    default:
      return;
  }
}

function sendState(): void {
  const cue = player.cue;
  relay.send({
    type: "state",
    presetTitle: player.title,
    chapter: cue?.kind === "scene" ? cue.chapter : null,
    scene: cue?.kind === "scene" ? cue.scene : null,
    mood: cue?.kind === "scene" ? cue.mood : [],
    page: cue?.kind === "page" ? cue.page : null,
    pageCount: player.cueCount,
  });
}

let audioStarted = false;
async function startAudio(): Promise<void> {
  if (audioStarted) return;
  audioStarted = true;
  await mixer.resume();
  hud.hideStart();
  const cue = player.cue;
  if (cue) mixer.setLayers(cue.sound, 2);
}

window.addEventListener("pointerdown", () => void startAudio());
window.addEventListener("keydown", (event) => {
  if (!audioStarted) {
    void startAudio();
    return;
  }
  switch (event.key) {
    case "ArrowRight":
    case " ":
    case "PageDown":
      player.next();
      break;
    case "ArrowLeft":
    case "PageUp":
      player.previous();
      break;
    case "Home":
      player.first();
      break;
    case "l":
    case "L":
      player.load(PresetSchema.parse(sample));
      break;
    case "k":
    case "K":
      player.load(PresetSchema.parse(sampleChapters));
      break;
    default:
      if (/^[1-9]$/.test(event.key)) player.goToIndex(Number(event.key) - 1);
  }
});

declare global {
  interface Window {
    illusionDebug?: { level(): number; layers(): string[]; cue(): Cue | null; code(): string | null; scale(): number };
  }
}
if (import.meta.env.DEV) {
  window.illusionDebug = {
    level: () => mixer.level(),
    layers: () => mixer.activeLayers(),
    cue: () => player.cue,
    code: () => pairingCode,
    scale: () => renderer.resolutionScale,
  };
}

function loop(nowMs: number): void {
  renderer.render(player.frame(nowMs));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
