import { MOTION_TYPES, type MotionType } from "@illusion/schema";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./fragment";
import { flattenPalette, type Rgb } from "./palette";

export interface Frame {
  palette: readonly Rgb[];
  brightness: number;
  contrast: number;
  motionA: MotionType;
  motionB: MotionType;
  mix: number;
  phase: number;
  time: number;
}

const MAX_DPR = 1.0;
const MIN_SCALE = 0.35;
const TARGET_FRAME_MS = 17;
const COMFORTABLE_FRAME_MS = 11;
const ADJUST_EVERY_FRAMES = 45;

/**
 * Renderer WebGL2 com resolução dinâmica: o conteúdo é borrado por natureza, então reduzir a
 * resolução interna e deixar o CSS esticar o canvas é quase invisível e salva GPUs fracas
 * (celular, smart TV, Chromecast).
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly uniforms: Record<string, WebGLUniformLocation>;
  private scale = 1;
  private lastFrameMs: number | null = null;
  private averageFrameMs = TARGET_FRAME_MS;
  private framesSinceAdjust = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) throw new Error("WebGL2 não disponível");
    this.gl = gl;

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const names = ["uResolution", "uPhase", "uTime", "uPalette", "uBrightness", "uContrast", "uMotionA", "uMotionB", "uMix"];
    this.uniforms = Object.fromEntries(
      names.map((name) => {
        const location = gl.getUniformLocation(program, name);
        if (!location) throw new Error(`uniform ausente: ${name}`);
        return [name, location];
      }),
    );

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  render(frame: Frame): void {
    this.adapt(frame.time * 1000);
    const { gl, uniforms } = this;
    gl.uniform2f(uniforms.uResolution!, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(uniforms.uPhase!, frame.phase);
    gl.uniform1f(uniforms.uTime!, frame.time);
    gl.uniform3fv(uniforms.uPalette!, flattenPalette(frame.palette));
    gl.uniform1f(uniforms.uBrightness!, frame.brightness);
    gl.uniform1f(uniforms.uContrast!, frame.contrast);
    gl.uniform1i(uniforms.uMotionA!, MOTION_TYPES.indexOf(frame.motionA));
    gl.uniform1i(uniforms.uMotionB!, MOTION_TYPES.indexOf(frame.motionB));
    gl.uniform1f(uniforms.uMix!, frame.mix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Escala atual da resolução interna, 0.35 a 1, para diagnóstico. */
  get resolutionScale(): number {
    return this.scale;
  }

  private adapt(nowMs: number): void {
    if (this.lastFrameMs !== null) {
      const dt = Math.min(nowMs - this.lastFrameMs, 100);
      this.averageFrameMs += (dt - this.averageFrameMs) * 0.1;
    }
    this.lastFrameMs = nowMs;

    if (++this.framesSinceAdjust < ADJUST_EVERY_FRAMES) return;
    this.framesSinceAdjust = 0;

    if (this.averageFrameMs > TARGET_FRAME_MS && this.scale > MIN_SCALE) {
      this.scale = Math.max(MIN_SCALE, this.scale * 0.85);
      this.resize();
    } else if (this.averageFrameMs < COMFORTABLE_FRAME_MS && this.scale < 1) {
      this.scale = Math.min(1, this.scale * 1.1);
      this.resize();
    }
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * this.scale;
    this.canvas.width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
}

function createProgram(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSrc));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`falha ao linkar shader: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("não foi possível criar shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`erro de compilação de shader: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}
