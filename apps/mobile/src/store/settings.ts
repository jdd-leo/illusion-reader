import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultServerHost } from "../api/config";

interface SettingsState {
  serverHost: string;
  lastCode: string | null;
  setServerHost: (host: string) => void;
  setLastCode: (code: string | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      serverHost: defaultServerHost(),
      lastCode: null,
      setServerHost: (serverHost) => set({ serverHost: serverHost.trim() }),
      setLastCode: (lastCode) => set({ lastCode }),
    }),
    { name: "illusion.settings", storage: createJSONStorage(() => Storage) },
  ),
);
