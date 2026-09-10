import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "@illusion/schema";
import { randomInt } from "node:crypto";
import type { WebSocket } from "ws";

export interface Room {
  code: string;
  receiver: WebSocket;
  controllers: Set<WebSocket>;
}

/** Salas de pareamento em memória. Uma TV por sala, N controles. */
export class Rooms {
  private readonly byCode = new Map<string, Room>();
  private readonly bySocket = new Map<WebSocket, Room>();

  createForReceiver(receiver: WebSocket): Room {
    let code = this.randomCode();
    while (this.byCode.has(code)) code = this.randomCode();
    const room: Room = { code, receiver, controllers: new Set() };
    this.byCode.set(code, room);
    this.bySocket.set(receiver, room);
    return room;
  }

  join(code: string, controller: WebSocket): Room | undefined {
    const room = this.byCode.get(code);
    if (!room) return undefined;
    room.controllers.add(controller);
    this.bySocket.set(controller, room);
    return room;
  }

  roomOf(socket: WebSocket): Room | undefined {
    return this.bySocket.get(socket);
  }

  /** Remove o socket da sala. Se era o receptor, a sala morre e os controles são devolvidos para aviso. */
  leave(socket: WebSocket): { room: Room; wasReceiver: boolean } | undefined {
    const room = this.bySocket.get(socket);
    if (!room) return undefined;
    this.bySocket.delete(socket);

    if (room.receiver === socket) {
      this.byCode.delete(room.code);
      for (const controller of room.controllers) this.bySocket.delete(controller);
      return { room, wasReceiver: true };
    }
    room.controllers.delete(socket);
    return { room, wasReceiver: false };
  }

  get size(): number {
    return this.byCode.size;
  }

  private randomCode(): string {
    let code = "";
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
      code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)];
    }
    return code;
  }
}
