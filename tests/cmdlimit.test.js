import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
const ctl = await import('../lib/control.js');
const { registry } = await import('../commands/index.js');
const { handleMessage } = await import('../lib/router.js');

const A = 'a'.repeat(24), B = 'b'.repeat(24);
const cmd = (n) => registry.get(n);

test('no limit by default', () => {
  assert.equal(ctl.sessionAllowed(A), null);
  assert.equal(ctl.isCmdBlockedFor(A, cmd('alive')), false);
});

test('limit: only the listed commands work, for that number only; the list is kept when the limit is switched off', () => {
  ctl.setSessionLimit(A, true, ['alive', 'alive']);
  assert.deepEqual(ctl.sessionLimit(A), { only: true, allowed: ['alive'] });
  assert.equal(ctl.isCmdBlockedFor(A, cmd('alive')), false);
  assert.equal(ctl.isCmdBlockedFor(A, cmd('menu')), true);
  assert.equal(ctl.isCmdBlockedFor(B, cmd('menu')), false); // another number is not touched
  ctl.setSessionLimit(A, false, ['alive']);
  assert.equal(ctl.isCmdBlockedFor(A, cmd('menu')), false);
  assert.deepEqual(ctl.sessionLimit(A).allowed, ['alive']);
});

test('menu text hides the blocked commands, only inside that number\'s own context', () => {
  const text = ['╭─❮ GENERAL ❯', '│ ✦ .alive', '╰─', '', '╭─❮ OTHER ❯', '│ ✦ .menu', '╰─', ''].join('\n');
  ctl.setSessionLimit(A, true, ['alive']);
  const forA = ctl.runAsSession(A, () => ctl.filterCaption(text));
  assert.match(forA, /\.alive/); assert.doesNotMatch(forA, /\.menu/); assert.doesNotMatch(forA, /OTHER/); // the empty section is gone too
  assert.equal(ctl.runAsSession(B, () => ctl.filterCaption(text)), text);
  assert.equal(ctl.filterCaption(text), text); // outside any number: unchanged
  ctl.setSessionLimit(A, false, []);
});

test('router: a blocked command answers "not enabled for this number" and does not run; an allowed one runs; other numbers are free', async () => {
  const sent = [];
  const sock = { user: { id: '94700000000:1@s.whatsapp.net' }, sendMessage: async (_j, c) => { sent.push(c); return {}; }, signalRepository: {} };
  let n = 0;
  const msg = (text) => ({ key: { remoteJid: '94711111111@s.whatsapp.net', id: `T${++n}${Date.now()}`, fromMe: false }, messageTimestamp: Math.floor(Date.now() / 1000), pushName: 'Tester', message: { conversation: text } });
  const said = () => JSON.stringify(sent);
  ctl.setSessionLimit(A, true, ['alive']);
  await handleMessage(sock, msg('.menu'), A);
  assert.match(said(), /not enabled for this number/);
  sent.length = 0;
  await handleMessage(sock, msg('.menu'), B);
  assert.doesNotMatch(said(), /not enabled for this number/);
  assert.ok(sent.length > 0);
  ctl.setSessionLimit(A, false, []);
});
