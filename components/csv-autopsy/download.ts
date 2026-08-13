/**
 * Save generated text as a local file. This only ever saves a report that CSV
 * Autopsy produced in-browser (Markdown or JSON) — never the user's dataset —
 * and touches nothing on the network.
 */
export function downloadText(filename: string, text: string, mime: string): boolean {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Give the click a tick to start before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
