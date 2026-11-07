import { proto, generateWAMessageFromContent, prepareWAMessageMedia, isJidGroup } from '@whiskeysockets/baileys';
import { remember } from './msgstore.js';
import { ownerChoices } from './carousel.js';
import fs from 'node:fs';
import path from 'node:path';
import { prettify } from './format.js';
import { formatUptime, greeting, mem, nowStrings } from './text.js';
import { DEFAULT_FOOTER, applyBrand, logoBuffer } from './brand.js';
import { filterButtons, filterCaption } from './control.js';
import { BOT_NAME, MENU_IMAGE, OWNER_NUMBER, PREFIX, ROOT_DIR, USE_BUTTONS } from './config.js';
import { getBotImage } from './botmedia.js';


function _aliveCaption(name) {
  const { date, time } = nowStrings();
  return [
    `╭━━━〔 💠 *${BOT_NAME}* 💠 〕━━━⬣`,
    `┃ ${greeting()}, *${name}*!`,
    '┃',
    '┃ ✅ *I am alive and running!*',
    `┃ ⏱️ Uptime  : ${formatUptime(process.uptime())}`,
    `┃ 🧠 RAM     : ${mem()}`,
    `┃ 📅 Date    : ${date}`,
    `┃ 🕒 Time    : ${time}`,
    `┃ 🔰 Prefix  : ${PREFIX}`,
    '╰━━━━━━━━━━━━━━━━━━━━⬣',
    '*මැරිලා කියලා හිතුවද උට්ටො....😒 තාම පණපිටින්...*',
    '',
    `👇 Tap a button, or send *${PREFIX}menu*`
  ].join('\n');
}

function _menuCaption(name) {
  const p = PREFIX;
  const { date, time } = nowStrings();
  return [
    `╭━━━〔 🐛 *${BOT_NAME} — BUG BOT* 🐛 〕━━━⬣`,
    `┃ 👾 Ayubowan *${name}*, ${greeting()}`,
    `┃ 🔰 Prefix : ${p}`,
    `┃ ⏱️ Uptime : ${formatUptime(process.uptime())}`,
    `┃ 📅 ${date}  🕒 ${time}`,
    '╰━━━━━━━━━━━━━━━━━━━━⬣',
    '',
    '╭━━━〔 ⚙️ *GENERAL* 〕━━━⬣',
    `┃ ✦ ${p}alive  — Bot alive check`,
    `┃ ✦ ${p}menu   — This menu`,
    '╰━━━━━━━━━━━━━━━━━━━━⬣',
    '',
    '╭━━━〔 🐛 *BUG COMMANDS* 〕━━━⬣',
    `┃ 💥 ${p}crash      — Notification overflow`,
    `┃ 👻 ${p}blankbug   — Invisible giant message`,
    `┃ 🌀 ${p}zalgo      — Glitch-text render lag`,
    `┃ 🔄 ${p}rtlbug     — BiDi flip crash`,
    `┃ 🔒 ${p}sysalert   — Fake system alert`,
    `┃ 📇 ${p}cspam      — Contact-list flood`,
    `┃ 🔁 ${p}repeatbug  — Repeat-text freeze`,
    `┃ 📋 ${p}bugmenu    — Bug command help`,
    '╰━━━━━━━━━━━━━━━━━━━━⬣',
    '',
    `_Usage: reply/mention or add number after cmd_`,
    `_e.g.  ${p}crash @tag | ${p}zalgo Hello 9477xxx_`,
  ].join('\n');
}

/* ---------- button helpers ---------- */
export const qr = (text, id) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: text, id }) });
export const copyBtn = (text, code) => ({ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: text, copy_code: code }) });
export const urlBtn = (text, url) => ({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: text, url, merchant_url: url }) });
const listBtn = (title, sections) => ({ name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections }) });

function _menuButtons() {
  const p = PREFIX;
  const buttons = [
    qr('✅ Alive', `${p}alive`),
  ];
  if (OWNER_NUMBER) buttons.push(urlBtn('👑 Chat Owner', `https://wa.me/${OWNER_NUMBER}`));
  return buttons;
}
function _aliveButtons() {
  const p = PREFIX;
  const buttons = [qr('📜 Menu', `${p}menu`)];
  if (OWNER_NUMBER) buttons.push(urlBtn('👑 Owner', `https://wa.me/${OWNER_NUMBER}`));
  return buttons;
}

// Native-flow interactive message (the type that shows real tappable buttons).
export async function sendInteractive(sock, jid, { image, body, footer, buttons }, quoted) {
  const buf = Buffer.isBuffer(image) ? image : image ? await fetchImage(image) : null; // download here (cached, with backup route) so WhatsApp never has to reach the host itself
  const media = buf ? await prepareWAMessageMedia({ image: buf }, { upload: sock.waUploadToServer }) : null;
  const IM = proto.Message.InteractiveMessage;
  const interactiveMessage = IM.create({
    header: IM.Header.create({ title: '', subtitle: '', hasMediaAttachment: !!media, ...(media || {}) }),
    body: IM.Body.create({ text: applyBrand(sock, body) }),
    footer: IM.Footer.create({ text: applyBrand(sock, footer) }),
    nativeFlowMessage: IM.NativeFlowMessage.create({ buttons, messageParamsJson: '' })
  });
  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage
      }
    }
  };
  const waMsg = generateWAMessageFromContent(jid, content, { userJid: sock.user?.id, quoted });
  const additionalNodes = [{
    tag: 'biz', attrs: {},
    content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }]
  }];
  if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
  remember(waMsg.key.id, waMsg.message); // relayMessage sends are not reported back, so keep them for retry requests
  await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id, additionalNodes });
}

// Default: image + caption (always shows up). With BUTTONS=on it tries tappable buttons first, but WhatsApp often
// accepts those and then silently never shows them, so they are opt-in. Any failure falls back to the next option.
const LOCAL_IMAGE = path.join(ROOT_DIR, 'public', 'ghost.png'); // always on disk, so a picture still shows when the remote link is dead
const LOCAL_MENU = path.join(ROOT_DIR, 'public', 'menu.jpg');   // optional: drop your menu picture here and it is used first (no network needed)
const IMG_TTL = 60 * 60 * 1000, IMG_RETRY = 60 * 1000, IMG_TIMEOUT = 20000;
const imgCache = new Map(); // url -> { buf, at } | { pending }

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(IMG_TIMEOUT), headers: { 'user-agent': 'Mozilla/5.0 (compatible; RIO-X-MD)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('empty image');
  return buf;
}
// Some hosts (catbox.moe) time out from Render. Try the direct link and an image proxy at the same time; the first one wins.
async function loadImage(url) {
  if (url === MENU_IMAGE && fs.existsSync(LOCAL_MENU)) return fs.readFileSync(LOCAL_MENU);
  if (!/^https?:\/\//i.test(url)) return fs.readFileSync(url);
  const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&output=jpg`;
  return Promise.any([download(url), download(proxy)]).catch((e) => { throw e?.errors?.[0] || e; });
}
// Returns a Buffer (cached for an hour). A failed download is retried after a minute and the bundled picture is used meanwhile.
export async function fetchImage(url) {
  const c = imgCache.get(url);
  if (c?.pending) return c.pending;
  if (c && Date.now() - c.at < (c.buf ? IMG_TTL : IMG_RETRY)) return c.buf || fs.readFileSync(LOCAL_IMAGE);
  const pending = loadImage(url)
    .then((buf) => { imgCache.set(url, { buf, at: Date.now() }); return buf; })
    .catch((err) => {
      console.error(`MENU_IMAGE could not be downloaded (${err?.message || err}); using the bundled picture. Check MENU_IMAGE: ${url}`);
      imgCache.set(url, { buf: null, at: Date.now() });
      return fs.readFileSync(LOCAL_IMAGE);
    });
  imgCache.set(url, { pending });
  return pending;
}
fetchImage(MENU_IMAGE).catch(() => {}); // warm the cache at startup so the first menu is instant
// slot: 'aliveImg' | 'menuImg' = the picture the host set in /admin → Bot media (a premium logo still comes first; no picture set = the built-in one)
export async function sendRich(sock, jid, { caption: plainCaption, buttons, footer, image = MENU_IMAGE, slot }, quoted) {
  if (image === MENU_IMAGE) image = (await logoBuffer(sock)) || (slot && await getBotImage(slot).catch(() => null)) || image; // premium logo replaces the default menu picture
  const ownerLines = USE_BUTTONS ? ownerChoices(sock, jid, quoted, buttons) : ''; // the owner cannot tap buttons of their own number: numbered choices instead
  const caption = prettify(USE_BUTTONS ? plainCaption + ownerLines : `${plainCaption}\n\n▸ ${PREFIX}menu · ${PREFIX}ping · ${PREFIX}owner`);
  if (USE_BUTTONS) {
    try {
      await sendInteractive(sock, jid, { image, body: caption, footer, buttons }, quoted);
      return;
    } catch (err) { console.error('Button send failed, using fallback:', err?.message || err); }
  }
  try {
    if (!image) throw new Error('no image');
    await sock.sendMessage(jid, { image: Buffer.isBuffer(image) ? image : await fetchImage(image), caption }, { quoted });
    return;
  } catch (err) { console.error('Image send failed, using text:', err?.message || err); }
  await sock.sendMessage(jid, { text: caption }, { quoted });
}

export const menuCaption = (name) => filterCaption(_menuCaption(name));
export const aliveCaption = (name) => filterCaption(_aliveCaption(name));
export const menuButtons = () => filterButtons(_menuButtons());
export const aliveButtons = () => filterButtons(_aliveButtons());
