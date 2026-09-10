import { RelayClient, type RelayStatus } from "@illusion/relay-client";
import type { ControlMessage, ReceiverState, RelayMessage } from "@illusion/schema";
import { create } from "zustand";
import { relayUrl } from "../api/config";
import { useSettings } from "./settings";

interface SessionState {
  status: RelayStatus | "idle";
  /** Código enviado no join; vira pareado quando o relay confirma. */
  pendingCode: string | null;
  pairedCode: string | null;
  tv: ReceiverState | null;
  error: string | null;
  connect: (code: string) => void;
  disconnect: () => void;
  send: (message: ControlMessage) => boolean;
}

let client: RelayClient | null = null;

export const useSession = create<SessionState>()((set, get) => ({
  status: "idle",
  pendingCode: null,
  pairedCode: null,
  tv: null,
  error: null,

  connect: (code) => {
    client?.dispose();
    set({ pendingCode: code, pairedCode: null, tv: null, error: null });

    client = new RelayClient({
      url: relayUrl(useSettings.getState().serverHost),
      onStatus: (status) => {
        set({ status });
        const pending = get().pendingCode;
        if (status === "open" && pending) client?.send({ type: "join", code: pending });
        if (status === "closed") set({ pairedCode: null });
      },
      onMessage: (message: RelayMessage) => {
        switch (message.type) {
          case "joined":
            useSettings.getState().setLastCode(message.code);
            set({ pairedCode: message.code, error: null });
            return;
          case "peer_left":
            set({ error: "A TV desconectou.", tv: null });
            return;
          case "state":
            set({ tv: message });
            return;
          case "error":
            set({ error: message.message });
            if (message.message.includes("código")) get().disconnect();
            return;
          default:
            return;
        }
      },
    });
  },

  disconnect: () => {
    client?.dispose();
    client = null;
    set({ status: "idle", pendingCode: null, pairedCode: null, tv: null });
  },

  send: (message) => client?.send(message) ?? false,
}));
