// General commands: menu and alive. This is the base: add your own commands as new objects here
// (or create a new .js file in commands/ that exports an array of commands, it is loaded automatically).
import { aliveButtons, aliveCaption, menuButtons, menuCaption, sendRich } from '../lib/menu.js';
import { sendMenuCarousel } from '../lib/menucards.js';
import { getMenuStyle } from '../lib/control.js';
import { sendAliveExtras } from '../lib/botmedia.js';

export default [
  {
    name: 'menu', aliases: ['help', 'list'],
    // .menu = the style the admin picked; .menu classic | .menu carousel (or .menu full = classic) shows one style on demand
    async run({ sock, msg, jid, name, footer, args }) {
      const want = String(args?.[0] || '').toLowerCase();
      const style = want === 'carousel' ? 'carousel' : (want === 'classic' || want === 'full') ? 'classic' : getMenuStyle();
      if (style === 'carousel') {
        try { return await sendMenuCarousel(sock, jid, { name, quoted: msg }); }
        catch (err) { console.error('Carousel menu failed, sending the classic menu:', err?.message || err); }
      }
      return sendRich(sock, jid, { caption: menuCaption(name), buttons: menuButtons(), footer, slot: 'menuImg' }, msg);
    },
  },
  {
    name: 'alive', aliases: ['bot'],
    async run({ sock, msg, jid, name, footer }) {
      await sendRich(sock, jid, { caption: aliveCaption(name), buttons: aliveButtons(), footer, slot: 'aliveImg' }, msg);
      return sendAliveExtras(sock, jid); // then the alive voice, then the video note (only the ones the host saved in /admin → Bot media)
    },
  },
];
