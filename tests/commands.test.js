import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
const { registry } = await import('../commands/index.js');

function ctx(name, args = []) {
  const out = [];
  const sock = {
    user: { id: '94771234567:5@s.whatsapp.net' },
    sendMessage: async (_j, c) => { out.push(c); return { key: { id: 'x' } }; },
    profilePictureUrl: async () => { throw new Error('none'); },
    groupMetadata: async () => ({ subject: 'G', participants: [{ id: '94771234567@s.whatsapp.net', admin: 'admin' }] }),
    groupFetchAllParticipating: async () => ({}),
    updateBlockStatus: async () => {}, readMessages: async () => {},
  };
  return { out, c: {
    sock, jid: '94770000000@s.whatsapp.net', sessionId: 'c'.repeat(24), args, command: name, name: 'Tester', footer: 'f',
    msg: { key: { remoteJid: '94770000000@s.whatsapp.net', id: 'M', fromMe: true }, message: { conversation: `.${name}` } },
    reply: async (t) => { out.push({ reply: t }); return { key: { id: 'r' } }; },
    isOwner: true, isAdmin: false, targetJid: () => '94770000001@s.whatsapp.net',
  } };
}
const text = (out) => out.map((o) => o.reply || o.text || o.caption || '').join('\n');

test('registry has only the base commands (menu, alive)', () => {
  assert.deepEqual([...new Set(registry.values())].map((c) => c.name).sort(), ['alive', 'menu']);
  for (const [n, cmd] of registry) assert.equal(typeof cmd.run, 'function', n);
});
test('every command runs without crashing when called with no arguments', async () => {
  const bad = [];
  for (const cmd of new Set(registry.values())) {
    const { c } = ctx(cmd.name);
    try { await Promise.race([cmd.run(c), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))]); }
    catch (e) { bad.push(`${cmd.name}: ${e.message}`); }
  }
  assert.deepEqual(bad, []);
});
