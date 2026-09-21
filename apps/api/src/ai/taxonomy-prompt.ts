import { MOTION_TYPES, SOUND_LAYER_IDS } from "@illusion/schema";

/**
 * Trechos de prompt gerados a partir da taxonomia, compartilhados pelas análises de página,
 * de livro e de capítulo. Ids de som e motions nunca saem de sincronia com o schema.
 */

export const VISUAL_GUIDE = `- palette: 3 a 5 cores hex "#rrggbb", ordenadas da MAIS ESCURA para a MAIS CLARA. A última é usada como cor de luz (brasas, estrelas, relâmpagos). Escolha pela hora do dia, ambiente e emoção. Evite cores saturadas puras; prefira tons que existiriam na cena.
- brightness 0..1: noite, porão, tensão 0.2 a 0.4; interiores à luz de vela 0.4 a 0.55; dia nublado 0.55 a 0.7; dia claro, neve, praia 0.7 a 0.85.
- contrast 0..1: cenas calmas e nebulosas 0.3 a 0.5; drama, tempestade, fogo 0.6 a 0.9.
- motion, um de: ${MOTION_TYPES.join(", ")}.
  static_glow: interiores calmos, luz de lampião, conversas. fire_flicker: lareira, fogueira, incêndio. rain_streaks: chuva. waves: mar, rio largo, sonho. fog_drift: névoa, floresta, memória, transição vaga. starfield: noite a céu aberto, espaço. pulse: tensão, suspense, batimento, tecnologia. embers: batalha, ruína, incêndio distante, faíscas. snowfall: neve, frio, silêncio. lightning: tempestade com raios, revelação violenta.
- speed 0..1: contemplação 0.1 a 0.3; normal 0.3 a 0.5; ação e tempestade 0.6 a 0.9.`;

export const SOUND_GUIDE = `- sound: 2 a 5 camadas, cada uma { id, gain }. Use SOMENTE ids desta lista: ${SOUND_LAYER_IDS.join(", ")}.
- gain 0..1: camada principal 0.5 a 0.8; secundárias 0.2 a 0.4; drones de tensão (drone_low, drone_dark, heartbeat, whispers) sempre discretos, 0.15 a 0.35.
- Prefira sons que o personagem ouviria na cena. Não invente clima que o texto não sugere.
- Não use camadas como preenchimento. creaking_wood só quando há madeira velha, barco ou casa rangendo; drones e heartbeat só quando há tensão real. Três camadas bem escolhidas valem mais que cinco genéricas.`;
