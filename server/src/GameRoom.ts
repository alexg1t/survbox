import { Room } from '@colyseus/core';
import { GameState } from './state.ts';

export class GameRoom extends Room<{ state: GameState }> {
  state = new GameState();
}
