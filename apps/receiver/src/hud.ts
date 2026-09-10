const LABEL_VISIBLE_MS = 2500;

export class Hud {
  private readonly label: HTMLElement;
  private readonly start: HTMLElement;
  private readonly code: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.label = document.createElement("div");
    this.label.className = "hud hidden";
    this.start = document.createElement("div");
    this.start.className = "start";
    this.start.textContent = "Toque ou pressione uma tecla para iniciar o som";
    this.code = document.createElement("div");
    this.code.className = "code hidden";
    document.body.append(this.label, this.code, this.start);
  }

  showPage(title: string | null, page: number | null): void {
    this.label.textContent = page === null ? "" : `${title ?? ""}  ·  pág. ${page}`;
    this.label.classList.remove("hidden");
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.label.classList.add("hidden"), LABEL_VISIBLE_MS);
  }

  /** Código de pareamento grande na tela enquanto nenhum controle está conectado. */
  showCode(code: string | null): void {
    if (code === null) {
      this.code.innerHTML = "<small>Conectando ao relay...</small>";
    } else {
      this.code.innerHTML = `<small>No celular, digite o código</small>${code.slice(0, 3)} ${code.slice(3)}`;
    }
    this.code.classList.remove("hidden");
  }

  hideCode(): void {
    this.code.classList.add("hidden");
  }

  hideStart(): void {
    this.start.remove();
  }
}
