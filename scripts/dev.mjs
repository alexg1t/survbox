// Runs server and client dev scripts side by side; Ctrl+C or either exiting stops both.
import { spawn } from 'node:child_process';

const procs = ['@game/server', '@game/client'].map((w) =>
  spawn(`npm run dev -w ${w}`, { stdio: 'inherit', shell: true }),
);
const stop = () => procs.forEach((p) => p.kill());
procs.forEach((p) => p.on('exit', stop));
process.on('SIGINT', stop);
