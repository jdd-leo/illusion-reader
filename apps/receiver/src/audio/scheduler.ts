export type Range = readonly [number, number];

export function randomIn([min, max]: Range): number {
  return min + Math.random() * (max - min);
}

interface Task {
  next: number;
  gap: Range;
  /** Retorna o intervalo até o próximo disparo, ou undefined para sortear em `gap`. */
  fire: (time: number) => number | undefined;
}

const TICK_MS = 100;
const LOOKAHEAD_SECONDS = 0.35;

/** Agenda eventos sonoros com lookahead, no relógio do AudioContext, para não sofrer com jitter de timers. */
export class Scheduler {
  private readonly tasks = new Set<Task>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(private readonly ctx: AudioContext) {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  add(gap: Range, fire: Task["fire"], startDelay = 0): () => void {
    const task: Task = { next: this.ctx.currentTime + startDelay + randomIn(gap) * Math.random(), gap, fire };
    this.tasks.add(task);
    return () => this.tasks.delete(task);
  }

  dispose(): void {
    clearInterval(this.timer);
    this.tasks.clear();
  }

  private tick(): void {
    const horizon = this.ctx.currentTime + LOOKAHEAD_SECONDS;
    for (const task of this.tasks) {
      let guard = 0;
      while (task.next < horizon && guard++ < 200) {
        const gap = task.fire(task.next) ?? randomIn(task.gap);
        task.next += Math.max(gap, 0.002);
      }
    }
  }
}
