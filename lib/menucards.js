// Swipeable "carousel" menu: one card per category (picture + command list + a 📂 Select button that opens that category's commands).
// Used by .menu when the admin picks the Carousel style (/admin -> Commands -> Menu style), or with `.menu carousel`.
import { BOT_NAME, MENU_IMAGE, PREFIX } from './config.js';
import { getBotImage } from './botmedia.js';
import { sendCards } from './carousel.js';
import { fetchImage, qr } from './menu.js';
import { logoBuffer } from './brand.js';
import { say } from './card.js';
import { filterButtons, filterCaption } from './control.js';
import { formatUptime, greeting, nowStrings } from './text.js';

// rows: [command, title shown in the select list, short description, usage hint shown on the card (optional)]
// Picking a row in the list runs that command (commands that need words just show how to use them).
const SECTIONS = [
  { icon: '⚙️', title: 'GENERAL', rows: [
    ['alive', 'Alive', 'Check the bot is running'],
    ['menu', 'Menu', 'Show the menu'] ] },
  { icon: '🐛', title: 'BUG', rows: [
    ['crash',     'Crash',       'Overflow notification bug',    '<@mention|num>'],
    ['blankbug',  'Blank Bug',   'Send invisible giant message', '<@mention|num>'],
    ['zalgo',     'Zalgo',       'Glitch-text rendering lag',    '[text] <num>'],
    ['rtlbug',    'RTL Bug',     'BiDi flip crash',              '[text] <num>'],
    ['sysalert',  'Fake Alert',  'Spoofed system message',       '<num>'],
    ['cspam',     'Contact Spam','Flood with dummy contacts',    '<num> [count]'],
    ['repeatbug', 'Repeat Bug',  'Repeat-text memory freeze',    '[word] <num>'],
  ] },
];

const p = PREFIX;

function cardBody(s) {
  const text = filterCaption([
    `╭─❮ ${s.icon} *${s.title}* ❯`,
    ...s.rows.map(([id, , , usage]) => `│ ✦ ${p}${id}${usage ? ` ${usage}` : ''}`),
    '╰──────────────⬣'
  ].join('\n'));
  return text.includes('│ ✦') ? text : null; // every command of this card is switched off: no card
}

// The 📂 Select button of a card: a list with that card's commands. Switched-off commands are removed by filterButtons().
const selectButton = (s) => ({
  name: 'single_select',
  buttonParamsJson: JSON.stringify({
    title: `📂 Select ${s.title.split(' ')[0]}`,
    sections: [{ title: `${s.icon} ${s.title}`, rows: s.rows.map(([id, title, desc]) => ({ header: '', title, description: desc, id: `${p}${id}` })) }]
  })
});

// A picture URL that coverBuffer() in carousel.js can "download" with no network: the picture is read once (cached by fetchImage) and passed as a data: link.
async function pictureLink(sock) {
  const src = (await logoBuffer(sock)) || (await getBotImage('menuImg').catch(() => null)) || MENU_IMAGE; // premium logo replaces the default picture, like the classic menu
  const buf = Buffer.isBuffer(src) ? src : await fetchImage(src);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

export async function sendMenuCarousel(sock, jid, { name, quoted }) {
  const { date, time } = nowStrings();
  const image = await pictureLink(sock);
  const cards = [];
  for (const s of SECTIONS) {
    const body = cardBody(s);
    if (!body) continue;
    const buttons = filterButtons([selectButton(s)]);
    buttons.push(qr('📜 Full menu', `${p}menu full`)); // every card keeps at least one button
    cards.push({ image, body, buttons });
  }
  if (!cards.length) throw new Error('no menu cards');
  // 1st message: the greeting box with the bot DP preview card (the same card every reply has); 2nd message: the swipe cards.
  const header = [
    `╭━━━〔 💠 *${BOT_NAME}* 💠 〕━━━⬣`,
    `┃ 👋 Hi *${name}*, ${greeting()}`,
    `┃ 🔰 Prefix : ${p}`,
    `┃ ⏱️ Uptime : ${formatUptime(process.uptime())}`,
    `┃ 📅 ${date}  🕒 ${time}`,
    '╰━━━━━━━━━━━━━━━━━━━━⬣'
  ].join('\n');
  try { await say(sock, jid, header, quoted); }
  catch (err) { console.error('Menu header card failed, sending the cards only:', err?.message || err); }
  const title = '👉 Swipe the cards, then tap 📂 Select to pick a command';
  await sendCards(sock, jid, { title, cards, quoted });
}
