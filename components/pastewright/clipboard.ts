/**
 * Clipboard writes for Pastewright.
 *
 * The pure engine produces the payloads; this thin layer performs the actual
 * browser writes and degrades honestly. Rich writes use the standards-based
 * `ClipboardItem` with both `text/html` and `text/plain`, so the receiving app
 * can choose. When rich writing is unavailable, unsupported, or denied, the
 * caller can fall back to a plain-text copy and explain what happened.
 */

export type RichCopyResult =
  { ok: true } | { ok: false; reason: 'unsupported' | 'insecure' | 'denied' | 'error' };

/** Copy plain text, with a legacy fallback for older/insecure contexts. */
export async function copyPlainText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Whether the browser can place rich (`text/html` + `text/plain`) data on the clipboard. */
export function canCopyRich(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

/** Copy both an HTML and a plain-text representation via `ClipboardItem`. */
export async function copyRich(payload: { html: string; text: string }): Promise<RichCopyResult> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { ok: false, reason: 'insecure' };
  }
  if (!canCopyRich()) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([payload.html], { type: 'text/html' }),
      'text/plain': new Blob([payload.text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return { ok: true };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    return { ok: false, reason: name === 'NotAllowedError' ? 'denied' : 'error' };
  }
}
