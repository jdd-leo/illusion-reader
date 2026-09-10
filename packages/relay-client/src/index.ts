import { RelayMessageSchema, type ClientMessage, type RelayMessage } from "@illusion/schema";

export type RelayStatus = "connecting" | "open" | "closed";

export interface RelayClientOptions {
  url: string;
  onMessage: (message: RelayMessage) => void;
  onStatus?: (status: RelayStatus) => void;
}

const RECONNECT_MS = 2000;

/** Cliente WebSocket do relay com reconexão e validação das mensagens recebidas. */
export class RelayClient {
  private socket: WebSocket | null = null;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: RelayClientOptions) {
    this.connect();
  }

  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  private connect(): void {
    this.options.onStatus?.("connecting");
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener("open", () => this.options.onStatus?.("open"));
    socket.addEventListener("message", (event) => {
      const parsed = RelayMessageSchema.safeParse(safeJson(String(event.data)));
      if (!parsed.success) {
        console.warn("[relay] mensagem inválida ignorada", parsed.error.issues);
        return;
      }
      this.options.onMessage(parsed.data);
    });
    socket.addEventListener("close", () => {
      this.options.onStatus?.("closed");
      if (this.disposed) return;
      this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_MS);
    });
    socket.addEventListener("error", () => socket.close());
  }
}

/** URL padrão do relay: mesmo host da página, porta 8787, a menos que a build defina outra. */
export function defaultRelayUrl(override: string | undefined): string {
  if (override) return override;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.hostname}:8787`;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
