// bugsend.js — Safe sendMessage wrapper for bug commands.
// Fixes the "No sessions" error that fires when the bot has never sent a message
// to a JID before (no Signal pre-key on file). We call assertSessions() first to
// establish the encryption handshake, then do the actual send with up to 2 retries.

import { jidNormalizedUser } from '@whiskeysockets/baileys';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ensure a Signal session exists for `jid`, then send `payload`.
 * Falls back gracefully if assertSessions isn't available on this Baileys build.
 *
 * @param {object} sock       - Baileys socket
 * @param {string} targetJid  - Destination JID (individual or group)
 * @param {object} payload    - Message payload object passed to sock.sendMessage
 * @param {object} [opts]     - Extra options passed to sock.sendMessage (e.g. { quoted })
 * @param {number} [retries]  - How many times to retry on "No sessions" (default 2)
 */
export async function bugSend(sock, targetJid, payload, opts = {}, retries = 2) {
  // ── Step 1: pre-warm the Signal session ──────────────────────────────────
  if (typeof sock.assertSessions === 'function') {
    try {
      // assertSessions fetches the pre-key bundle from WhatsApp's servers and
      // builds the Signal session so sendMessage won't throw "No sessions".
      await sock.assertSessions([jidNormalizedUser(targetJid)], true);
    } catch (e) {
      // Non-fatal — the send might still work (session could already exist).
      console.warn(`[bugsend] assertSessions warn for ${targetJid}:`, e?.message || e);
    }
  }

  // ── Step 2: send with retry ───────────────────────────────────────────────
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await sock.sendMessage(targetJid, payload, opts);
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      // Only retry on session-related errors
      if (/no sessions|session|not-acceptable|rate-over-limit/i.test(msg) && attempt < retries) {
        console.warn(`[bugsend] attempt ${attempt + 1} failed (${msg}), retrying in ${(attempt + 1) * 1200}ms…`);
        await sleep((attempt + 1) * 1200);
        // Try to assert session again before retry
        if (typeof sock.assertSessions === 'function') {
          try { await sock.assertSessions([jidNormalizedUser(targetJid)], true); } catch { /* ignore */ }
        }
        continue;
      }
      throw err; // non-session error or retries exhausted
    }
  }
  throw lastErr;
}
