import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom.ts';

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: { game: defineRoom(GameRoom) },
});

server.listen(Number(process.env.PORT ?? 2567));
