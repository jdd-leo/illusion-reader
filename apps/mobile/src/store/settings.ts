import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultServerHost } from "../api/config";
import { DEFAULT_MINUTES_PER_PAGE } from "../lib/sceneClock";

interface SettingsState {
  serverHost: string;
  lastCode: string | null;
  /** Velocidade de leitura aprendida, base do avanço de cenas por tempo. */
  minutesPerPage: number;
  /** Mostra o modo página a página (fotografar cada página). Fora do fluxo principal. */
  advancedMode: boolean;
  onboardingDone: boolean;
  setServerHost: (host: string) => void;
  setLastCode: (code: string | null) => void;
  setMinutesPerPage: (minutes: number) => void;
  setAdvancedMode: (enabled: boolean) => void;
  setOnboardingDone: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      serverHost: defaultServerHost(),
      lastCode: null,
      minutesPerPage: DEFAULT_MINUTES_PER_PAGE,
      advancedMode: false,
      onboardingDone: false,
      setServerHost: (serverHost) => set({ serverHost: serverHost.trim() }),
      setLastCode: (lastCode) => set({ lastCode }),
      setMinutesPerPage: (minutesPerPage) => set({ minutesPerPage }),
      setAdvancedMode: (advancedMode) => set({ advancedMode }),
      setOnboardingDone: () => set({ onboardingDone: true }),
    }),
    { name: "illusion.settings", storage: createJSONStorage(() => Storage) },
  ),
);
