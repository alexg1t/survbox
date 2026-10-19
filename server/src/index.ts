import { fileURLToPath } from 'node:url';
import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { GameRoom } from './GameRoom.ts';

// In production one service serves both the built client and the game socket.
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: { game: defineRoom(GameRoom) },
  express: (app) => {
    app.use(express.static(CLIENT_DIST));
  },
});

server.listen(Number(process.env.PORT ?? 2567));
