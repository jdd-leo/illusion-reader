import type { MotionType, Preset, SoundLayer, Visual } from "@illusion/schema";
import { lerpPalette, resamplePalette, type Rgb } from "./visual/palette";
import type { Frame } from "./visual/renderer";

interface VisualState {
  palette: Rgb[];
  brightness: number;
  contrast: number;
  speed: number;
}

/** O que o receptor renderiza em um dado momento: uma cena de capítulo ou uma página, já achatadas. */
export type Cue =
  | { kind: "scene"; chapter: number; scene: number; mood: string[]; visual: Visual; sound: SoundLayer[]; transitionSeconds: number }
  | { kind: "page"; page: number; visual: Visual; sound: SoundLayer[]; transitionSeconds: number };

const IDLE_VISUAL: Visual = {
  palette: ["#050608", "#15181f", "#2a2f3a"],
  brightness: 0.3,
  contrast: 0.3,
  motion: "fog_drift",
  speed: 0.1,
};

/**
 * Mantém o preset e a cena atual e interpola os parâmetros visuais entre a cena anterior e a nova
 * ao longo de transitionSeconds. A fase do shader é acumulada com a velocidade interpolada,
 * então mudar de speed não causa salto na animação.
 *
 * O receptor não tem noção de tempo de leitura: quem decide quando trocar de cena é o controle.
 */
export class Player {
  private cues: Cue[] = [];
  private presetTitle: string | null = null;
  private index = -1;
  private from: VisualState;
  private to: VisualState;
  private motionA: MotionType;
  private motionB: MotionType;
  private transitionStartMs = 0;
  private transitionSeconds = 0;
  private phase = 0;
  private lastFrameMs: number | null = null;

  constructor(private readonly onCueChange: (cue: Cue | null) => void) {
    this.from = toState(IDLE_VISUAL);
    this.to = this.from;
    this.motionA = IDLE_VISUAL.motion;
    this.motionB = IDLE_VISUAL.motion;
  }

  get cue(): Cue | null {
    return this.cues[this.index] ?? null;
  }

  get title(): string | null {
    return this.presetTitle;
  }

  get cueCount(): number {
    return this.cues.length;
  }

  /**
   * Carrega um preset. Prefere capítulos; cai para páginas quando não há.
   * A posição inicial é capítulo+cena, ou página impressa, ou a primeira cena.
   */
  load(preset: Preset, start?: { chapter?: number | undefined; scene?: number | undefined; page?: number | undefined }): void {
    this.cues = preset.chapters.length > 0 ? flattenChapters(preset) : flattenPages(preset);
    this.presetTitle = preset.title;
    this.index = -1;
    if (start?.chapter !== undefined) this.goToIndex(this.indexForScene(start.chapter, start.scene ?? 0));
    else if (start?.page !== undefined) this.goToIndex(this.indexForPage(start.page));
    else this.goToIndex(0);
  }

  next(): void {
    this.goToIndex(this.index + 1);
  }

  previous(): void {
    this.goToIndex(this.index - 1);
  }

  first(): void {
    this.goToIndex(0);
  }

  /** Vai para a página impressa; se ela não estiver no preset, usa a última página anterior a ela. */
  goToPage(printedPage: number): void {
    this.goToIndex(this.indexForPage(printedPage));
  }

  /** Vai para a cena de um capítulo; capítulo ausente cai no último anterior, cena além do fim cai na última. */
  goToScene(chapter: number, scene: number): void {
    this.goToIndex(this.indexForScene(chapter, scene));
  }

  goToIndex(index: number): void {
    if (this.cues.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this.cues.length - 1));
    if (clamped === this.index) return;

    const now = performance.now();
    this.from = this.interpolated(now);
    this.motionA = this.motionB;

    this.index = clamped;
    const cue = this.cues[clamped]!;
    this.to = toState(cue.visual);
    this.motionB = cue.visual.motion;
    this.transitionStartMs = now;
    this.transitionSeconds = cue.transitionSeconds;
    this.onCueChange(cue);
  }

  frame(nowMs: number): Frame {
    const dt = this.lastFrameMs === null ? 0 : (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;

    const mix = this.mix(nowMs);
    const state = this.interpolated(nowMs);
    this.phase += dt * (0.2 + state.speed * 1.5);

    return {
      palette: state.palette,
      brightness: state.brightness,
      contrast: state.contrast,
      motionA: this.motionA,
      motionB: this.motionB,
      mix,
      phase: this.phase,
      time: nowMs / 1000,
    };
  }

  private indexForPage(printedPage: number): number {
    let best = 0;
    for (const [i, cue] of this.cues.entries()) {
      if (cue.kind !== "page") continue;
      if (cue.page <= printedPage) best = i;
      else break;
    }
    return best;
  }

  private indexForScene(chapter: number, scene: number): number {
    let best = 0;
    for (const [i, cue] of this.cues.entries()) {
      if (cue.kind !== "scene") continue;
      if (cue.chapter < chapter || (cue.chapter === chapter && cue.scene <= scene)) best = i;
      else break;
    }
    return best;
  }

  private mix(nowMs: number): number {
    if (this.transitionSeconds <= 0) return 1;
    const progress = Math.min(1, (nowMs - this.transitionStartMs) / 1000 / this.transitionSeconds);
    return progress * progress * (3 - 2 * progress);
  }

  private interpolated(nowMs: number): VisualState {
    const t = this.mix(nowMs);
    return {
      palette: lerpPalette(this.from.palette, this.to.palette, t),
      brightness: lerp(this.from.brightness, this.to.brightness, t),
      contrast: lerp(this.from.contrast, this.to.contrast, t),
      speed: lerp(this.from.speed, this.to.speed, t),
    };
  }
}

function flattenChapters(preset: Preset): Cue[] {
  return preset.chapters.flatMap((chapter) =>
    chapter.scenes.map((scene, position): Cue => ({
      kind: "scene",
      chapter: chapter.index,
      scene: position,
      mood: scene.mood,
      visual: scene.visual,
      sound: scene.sound,
      transitionSeconds: scene.transitionSeconds,
    })),
  );
}

function flattenPages(preset: Preset): Cue[] {
  return [...preset.pages]
    .sort((a, b) => a.page - b.page)
    .map((page): Cue => ({ kind: "page", page: page.page + preset.pageOffset, visual: page.visual, sound: page.sound, transitionSeconds: page.transitionSeconds }));
}

function toState(visual: Visual): VisualState {
  return {
    palette: resamplePalette(visual.palette),
    brightness: visual.brightness,
    contrast: visual.contrast,
    speed: visual.speed,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
