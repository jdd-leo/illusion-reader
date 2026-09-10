import type { MotionType, Page, Preset, Visual } from "@illusion/schema";
import { lerpPalette, resamplePalette, type Rgb } from "./visual/palette";
import type { Frame } from "./visual/renderer";

interface VisualState {
  palette: Rgb[];
  brightness: number;
  contrast: number;
  speed: number;
}

const IDLE_VISUAL: Visual = {
  palette: ["#050608", "#15181f", "#2a2f3a"],
  brightness: 0.3,
  contrast: 0.3,
  motion: "fog_drift",
  speed: 0.1,
};

/**
 * Mantém o preset e a página atual e interpola os parâmetros visuais entre a página anterior e a nova
 * ao longo de transitionSeconds. A fase do shader é acumulada com a velocidade interpolada,
 * então mudar de speed não causa salto na animação.
 */
export class Player {
  private pages: Page[] = [];
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

  constructor(private readonly onPageChange: (page: Page | null) => void) {
    this.from = toState(IDLE_VISUAL);
    this.to = this.from;
    this.motionA = IDLE_VISUAL.motion;
    this.motionB = IDLE_VISUAL.motion;
  }

  get page(): Page | null {
    return this.pages[this.index] ?? null;
  }

  get title(): string | null {
    return this.presetTitle;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Carrega um preset e vai para a página impressa informada (ou a primeira). */
  load(preset: Preset, printedPage?: number): void {
    this.pages = [...preset.pages].sort((a, b) => a.page - b.page).map((page) => ({ ...page, page: page.page + preset.pageOffset }));
    this.presetTitle = preset.title;
    this.index = -1;
    this.goToIndex(printedPage === undefined ? 0 : this.indexForPage(printedPage));
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

  goToIndex(index: number): void {
    if (this.pages.length === 0) return;
    const clamped = Math.max(0, Math.min(index, this.pages.length - 1));
    if (clamped === this.index) return;

    const now = performance.now();
    this.from = this.interpolated(now);
    this.motionA = this.motionB;

    this.index = clamped;
    const page = this.pages[clamped]!;
    this.to = toState(page.visual);
    this.motionB = page.visual.motion;
    this.transitionStartMs = now;
    this.transitionSeconds = page.transitionSeconds;
    this.onPageChange(page);
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
    for (const [i, page] of this.pages.entries()) {
      if (page.page <= printedPage) best = i;
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
