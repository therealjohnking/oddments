/**
 * Two reference samples used by the UI ("Load example") and by the tests as
 * calibration anchors:
 *
 *  - CLEAN_SAMPLE  — ordinary, plainly-written human prose. Should score low.
 *  - SLOP_SAMPLE   — a deliberately atrocious thought-leadership post that
 *    exercises most detectors. Should land in the top band.
 *
 * The slop sample uses real em dashes, ellipses, curly quotes, and emoji on
 * purpose — those are exactly the tics Slopometer is reacting to, and (unlike
 * the invisible-character tool) they are perfectly legible in source.
 */

export const CLEAN_SAMPLE = `We repainted the back fence over the weekend. The old boards had gone
grey and a couple near the gate were starting to rot, so my neighbour lent me a
saw and we replaced the worst three before priming the rest.

It took longer than I expected, mostly because the primer needed two coats and
the second one had to dry overnight. By Sunday afternoon the whole run looked
tidy again. Next spring I want to plant something along the base so the wood
weathers a little more slowly than last time.`;

export const SLOP_SAMPLE = `Let me be clear: most people will never read this.

But you did. 🙌

Here's the thing nobody tells you about success.

It's not about the money — it's about impact.

Read that again. Let that sink in.

Three years ago I had nothing. Today I lead a team of 40. What changed? EVERYTHING.

The truth is, I stopped chasing low-hanging fruit and found my north star. 🚀

I learned to leverage my strengths, circle back on what mattered, and move the needle every single day.

This is not a tactic, but a mindset.

Work hard. Stay humble. Keep shipping.

Your network is your net worth. Your mindset is your moat. Your calendar is your strategy. Your excuses are your ceiling.

Want to unlock your potential? Want to become the best version of yourself? Want to actually move the needle?

Then trust the process...

This changed everything for me — and it will change everything for you too!!!

Success isn't a destination... it's a journey.

Most people quit here. Most people stay comfortable. Most people never even start.

Not you.

Save this for later. Your future self will thank you.

Agree? 🔥`;
