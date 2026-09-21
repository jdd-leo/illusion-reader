import { useEffect, useRef } from "react";
import type { EmitterSubscription } from "react-native";

/**
 * Botões de volume (e controles Bluetooth, que emitem as mesmas teclas) como "próximo capítulo".
 * Não há evento de tecla no React Native; o que existe é o evento de mudança de volume. Enquanto
 * a leitura está ativa o volume de mídia do celular fica no meio, para os dois botões sempre
 * produzirem mudança, e é devolvido ao valor original ao sair. O som da leitura toca na TV,
 * então o volume do celular não importa nesse momento.
 *
 * O módulo é nativo: no Expo Go não existe e o hook vira um no-op.
 */

interface VolumeModule {
  getVolume(): Promise<{ volume: number }>;
  setVolume(value: number, config?: { showUI?: boolean }): Promise<void>;
  showNativeVolumeUI(config: { enabled: boolean }): Promise<void>;
  addVolumeListener(callback: (result: { volume: number }) => void): EmitterSubscription;
}

const PARKED_VOLUME = 0.5;
const DEBOUNCE_MS = 400;

function loadModule(): VolumeModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("react-native-volume-manager") as { VolumeManager?: VolumeModule };
    return loaded.VolumeManager ?? null;
  } catch {
    return null;
  }
}

export function useVolumeButtons(onPress: () => void, enabled: boolean): void {
  const handler = useRef(onPress);
  handler.current = onPress;

  useEffect(() => {
    if (!enabled) return;
    const volume = loadModule();
    if (!volume) return;

    let subscription: EmitterSubscription | null = null;
    let original: number | null = null;
    let lastPress = 0;
    let disposed = false;

    void (async () => {
      try {
        original = (await volume.getVolume()).volume;
        await volume.showNativeVolumeUI({ enabled: false });
        await volume.setVolume(PARKED_VOLUME, { showUI: false });
        if (disposed) return;
        subscription = volume.addVolumeListener((result) => {
          if (Math.abs(result.volume - PARKED_VOLUME) < 0.01) return;
          void volume.setVolume(PARKED_VOLUME, { showUI: false });
          const now = Date.now();
          if (now - lastPress < DEBOUNCE_MS) return;
          lastPress = now;
          handler.current();
        });
      } catch {
        // sem módulo nativo funcional: segue só com o toque na tela
      }
    })();

    return () => {
      disposed = true;
      subscription?.remove();
      void volume.showNativeVolumeUI({ enabled: true }).catch(() => undefined);
      if (original !== null) void volume.setVolume(original, { showUI: false }).catch(() => undefined);
    };
  }, [enabled]);
}
