import { ClientMessageSchema, type RelayMessage } from "@illusion/schema";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { Rooms } from "./rooms";

const MAX_PAYLOAD_BYTES = 1024 * 1024;
const HEARTBEAT_MS = 30_000;

function send(socket: WebSocket, message: RelayMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

/** Anexa o relay de pareamento (WebSocket) a um servidor HTTP existente. */
export function attachRelay(server: Server): Rooms {
  const rooms = new Rooms();
  const alive = new WeakSet<WebSocket>();
  const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD_BYTES });

  wss.on("connection", (socket) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));

    socket.on("message", (raw) => {
      const parsed = ClientMessageSchema.safeParse(safeJson(raw.toString()));
      if (!parsed.success) {
        send(socket, { type: "error", message: "mensagem inválida" });
        return;
      }
      const message = parsed.data;

      switch (message.type) {
        case "register": {
          if (rooms.roomOf(socket)) {
            send(socket, { type: "error", message: "já registrado" });
            return;
          }
          const room = rooms.createForReceiver(socket);
          send(socket, { type: "registered", code: room.code });
          console.log(`[relay] receptor registrado ${room.code} (${rooms.size} salas)`);
          return;
        }
        case "join": {
          if (rooms.roomOf(socket)) {
            send(socket, { type: "error", message: "já pareado" });
            return;
          }
          const room = rooms.join(message.code, socket);
          if (!room) {
            send(socket, { type: "error", message: "código não encontrado" });
            return;
          }
          send(socket, { type: "joined", code: room.code });
          send(room.receiver, { type: "peer_joined" });
          console.log(`[relay] controle entrou em ${room.code}`);
          return;
        }
        case "state": {
          const room = rooms.roomOf(socket);
          if (!room || room.receiver !== socket) return;
          for (const controller of room.controllers) send(controller, message);
          return;
        }
        default: {
          const room = rooms.roomOf(socket);
          if (!room || !room.controllers.has(socket)) {
            send(socket, { type: "error", message: "não pareado" });
            return;
          }
          send(room.receiver, message);
        }
      }
    });

    socket.on("close", () => {
      const left = rooms.leave(socket);
      if (!left) return;
      if (left.wasReceiver) {
        for (const controller of left.room.controllers) send(controller, { type: "peer_left" });
        console.log(`[relay] receptor saiu de ${left.room.code}`);
      } else {
        send(left.room.receiver, { type: "peer_left" });
      }
    });
  });

  setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, HEARTBEAT_MS);

  return rooms;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
