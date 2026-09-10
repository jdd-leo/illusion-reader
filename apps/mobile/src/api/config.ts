import Constants from "expo-constants";

export const DEFAULT_PORT = 8787;

/** Em desenvolvimento o servidor costuma rodar na mesma máquina do Metro; usa esse IP como padrão. */
export function defaultServerHost(): string {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `${host ?? "192.168.0.10"}:${DEFAULT_PORT}`;
}

export const apiUrl = (host: string): string => `http://${host}`;
export const relayUrl = (host: string): string => `ws://${host}`;
