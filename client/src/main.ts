import { Client, type Room } from '@colyseus/sdk';
import { COMBO, INFINITE, WEAPONS, multiplierOf } from '@game/shared';
import type { GameState } from '@game/server/src/state.ts';
import * as Phaser from 'phaser';
import { hex, PLAYER_COLORS } from './art.ts';
import { GameScene } from './GameScene.ts';
import { $, show, toast } from './ui.ts';

const client = new Client(`ws://${location.hostname}:2567`);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14161a',
  scale: { mode: Phaser.Scale.RESIZE },
});
game.scene.add('game', GameScene);

const DEBUG = new URLSearchParams(location.search).has('debug');
let room: Room<any, GameState> | null = null;
let phase = '';

const scene = () => game.scene.getScene('game') as GameScene;

async function enter(join: () => Promise<Room<any, GameState>>) {
  $('#menu-error').textContent = '';
  try {
    room = await join();
  } catch (err) {
    $('#menu-error').textContent = joinError(err);
    return;
  }
  phase = '';
  const r = room;
  if (DEBUG) Object.assign(window, { room, game });
  room.onMessage('shot', (m) => scene().sys.isActive() && scene().shot(m));
  room.onMessage('boom', (m) => scene().sys.isActive() && scene().boom(m));
  room.onMessage('unlock', (m: { id: string; w: number }) => m.id === r.sessionId && toast(`¡Nueva arma: ${WEAPONS[m.w].name}!`));
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
      if (phase === 'intermission') {
        toast(`Oleada ${state.wave}`, 2500);
        if (DEBUG) room.send('debugUnlock');
      }
    }
  }
  const isHost = state.hostId === room.sessionId;
  if (phase === 'lobby') {
    $('#lobby-code').textContent = room.roomId;
    $('#lobby-players').innerHTML = [...state.players]
      .sort(([, a], [, b]) => a.joinOrder - b.joinOrder)
      .map(([id, p]) => `<li><span class="swatch" style="background:${hex(PLAYER_COLORS[p.color])}"></span>${escape(p.name)}${id === state.hostId ? ' <span class="muted">(anfitrión)</span>' : ''}</li>`)
      .join('');
    $('#start').hidden = !isHost;
    $('#lobby-wait').hidden = isHost;
  } else if (phase !== 'gameover') {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    const ammo = me.ammo[me.weapon];
    $('#hud-hp').textContent = me.alive ? `Vida ${me.hp}` : 'Eliminado: vuelves en la siguiente oleada';
    $('#hud-weapon').textContent = `${WEAPONS[me.weapon].name}  ${ammo === INFINITE ? '∞' : ammo}`;
    $('#hud-combo').textContent = `Combo ${me.combo}  ×${multiplierOf(me.combo)}  ·  ${me.score} pts`;
    $('#hud-combo-bar').style.width = `${(me.comboTime / COMBO.window) * 100}%`;
    $('#hud-wave').textContent = `Oleada ${state.wave}`;
    $('#hud-code').textContent = `Sala ${room.roomId}`;
  }
}

function joinError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (msg.includes('IN_PROGRESS')) return 'Partida en curso';
  if (msg.includes('locked')) return 'Sala llena';
  if (msg.includes('not found')) return 'Sala no encontrada';
  return 'No se pudo conectar';
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const name = () => $<HTMLInputElement>('#name').value;
const code = () => $<HTMLInputElement>('#code').value.replace(/\s+/g, '').toUpperCase();

const create = () => enter(() => client.create('game', { name: name() }));
const join = () => code() && enter(() => client.joinById(code(), { name: name() }));

$('#create').onclick = create;
$('#join').onclick = join;
$('#name').onkeydown = (e) => e.key === 'Enter' && (code() ? join() : create());
$('#code').onkeydown = (e) => e.key === 'Enter' && join();
$('#start').onclick = () => room?.send('start');
$('#copy').onclick = () => {
  const link = `${location.origin}/?room=${room?.roomId}`;
  // clipboard needs a secure context; plain-http LAN addresses fall back to a prompt
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Enlace copiado'));
  else prompt('Copia el enlace', link);
};

const linked = new URLSearchParams(location.search).get('room');
if (linked) {
  $<HTMLInputElement>('#code').value = linked;
  $('#name').focus();
}

show('menu');
