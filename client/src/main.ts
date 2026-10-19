import { Client, type Room } from '@colyseus/sdk';
import type { GameState } from '@game/server/src/state.ts';
import * as Phaser from 'phaser';
import { hex, PLAYER_COLORS } from './art.ts';
import { GameScene } from './GameScene.ts';
import { $, show } from './ui.ts';

const client = new Client(`ws://${location.hostname}:2567`);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14161a',
  scale: { mode: Phaser.Scale.RESIZE },
});
game.scene.add('game', GameScene);

let room: Room<any, GameState> | null = null;
let phase = '';

const scene = () => game.scene.getScene('game') as GameScene;

async function enter(join: () => Promise<Room<any, GameState>>) {
  $('#menu-error').textContent = '';
  try {
    room = await join();
  } catch (err) {
    $('#menu-error').textContent = 'No se pudo conectar';
    console.error(err);
    return;
  }
  phase = '';
  room.onMessage('shot', (m) => scene().sys.isActive() && scene().shot(m));
  room.onStateChange(onState);
  room.onLeave(() => {
    game.scene.stop('game');
    room = null;
    show('menu');
  });
}

function onState(state: GameState) {
  if (!room) return;
  if (state.phase !== phase) {
    phase = state.phase;
    if (phase === 'lobby') {
      game.scene.stop('game');
      show('lobby');
    } else if (phase === 'gameover') {
      show('gameover');
    } else {
      if (!game.scene.isActive('game')) game.scene.start('game', { room });
      show('hud');
    }
  }
  const isHost = state.hostId === room.sessionId;
  if (phase === 'lobby') {
    $('#lobby-code').textContent = room.roomId;
    $('#lobby-players').innerHTML = [...state.players.values()]
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map((p) => `<li><span class="swatch" style="background:${hex(PLAYER_COLORS[p.color])}"></span>${escape(p.name)}</li>`)
      .join('');
    $('#start').hidden = !isHost;
    $('#lobby-wait').hidden = isHost;
  } else if (phase !== 'gameover') {
    const me = state.players.get(room.sessionId);
    $('#hud-hp').textContent = `Vida ${me?.hp ?? 0}`;
    $('#hud-code').textContent = `Sala ${room.roomId}`;
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const name = () => $<HTMLInputElement>('#name').value;

$('#create').onclick = () => enter(() => client.create('game', { name: name() }));
$('#start').onclick = () => room?.send('start');

show('menu');
