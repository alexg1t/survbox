import { Client } from '@colyseus/sdk';
import * as Phaser from 'phaser';
import { show } from './ui.ts';

export const client = new Client(`ws://${location.hostname}:2567`);

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14161a',
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [],
});

show('menu');
