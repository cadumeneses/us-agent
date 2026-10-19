import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

export async function readPassword(prompt = 'Senha inicial: ') {
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  try {
    return await new Promise(resolve => {
      terminal.question(process.stdin.isTTY ? prompt : '', resolve);
      muted = true;
    });
  } finally { muted = false; terminal.close(); if (process.stdin.isTTY) process.stdout.write('\n'); }
}
