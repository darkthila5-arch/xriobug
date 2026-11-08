# No Sessions Fix + Owner LID Fix

## Files changed
- `lib/selfheal.js` — added `guardAllSends()` function
- `lib/session.js` — calls `guardAllSends()` on every new socket

## What was wrong
Every `sock.sendMessage()` call was throwing "No sessions" because
Baileys' Signal key store had no pre-key for contacts who messaged
the bot. The fix pre-asserts the Signal session for each JID before
the first send (cached 5 min so it doesn't hammer WA servers).

## Also fix: OWNER_LID (do this in Render env vars)
Your LID from the log is: 52841485988054

Add this to your Render environment variables:
  OWNER_LID=52841485988054

This makes .gcrash, .promenu, .delayhard etc work from your number.
