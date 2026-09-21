import { z } from "zod";
import { PresetSchema } from "./preset";

/**
 * Protocolo entre controle (celular), relay e receptor (TV).
 * O relay só trata register/join e encaminha o resto para o par da sala.
 */

export const PAIRING_CODE_LENGTH = 6;
/** Sem 0/O/1/I para leitura fácil na TV. */
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PairingCodeSchema = z
  .string()
  .length(PAIRING_CODE_LENGTH)
  .regex(new RegExp(`^[${PAIRING_CODE_ALPHABET}]+$`), "código inválido");

const pageNumber = z.number().int().positive();
const chapterIndex = z.number().int().positive();
/** Posição da cena dentro do capítulo, a partir de 0. */
const sceneIndex = z.number().int().nonnegative();

/** Controle -> receptor. */
export const ControlMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("load_preset"),
    preset: PresetSchema,
    /** Posição inicial: capítulo e cena (fluxo principal) ou página impressa (modo avançado). */
    chapter: chapterIndex.optional(),
    scene: sceneIndex.optional(),
    page: pageNumber.optional(),
  }),
  z.object({ type: z.literal("goto_scene"), chapter: chapterIndex, scene: sceneIndex }),
  z.object({ type: z.literal("goto"), page: pageNumber }),
  z.object({ type: z.literal("next") }),
  z.object({ type: z.literal("prev") }),
]);

/** Receptor -> controle. */
export const ReceiverStateSchema = z.object({
  type: z.literal("state"),
  presetTitle: z.string().nullable(),
  /** Preenchidos quando o receptor está em uma cena de capítulo. */
  chapter: chapterIndex.nullable().default(null),
  scene: sceneIndex.nullable().default(null),
  mood: z.array(z.string()).default([]),
  /** Preenchido quando o receptor está em uma página (modo avançado). */
  page: pageNumber.nullable(),
  /** Total de cenas carregadas, de capítulos ou de páginas. */
  pageCount: z.number().int().nonnegative(),
});

/** Cliente -> relay. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("register") }),
  z.object({ type: z.literal("join"), code: PairingCodeSchema }),
  ...ControlMessageSchema.options,
  ReceiverStateSchema,
]);

/** Relay -> cliente. */
export const RelayMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("registered"), code: PairingCodeSchema }),
  z.object({ type: z.literal("joined"), code: PairingCodeSchema }),
  z.object({ type: z.literal("peer_joined") }),
  z.object({ type: z.literal("peer_left") }),
  z.object({ type: z.literal("error"), message: z.string() }),
  ...ControlMessageSchema.options,
  ReceiverStateSchema,
]);

export type ControlMessage = z.infer<typeof ControlMessageSchema>;
export type ReceiverState = z.infer<typeof ReceiverStateSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type RelayMessage = z.infer<typeof RelayMessageSchema>;
