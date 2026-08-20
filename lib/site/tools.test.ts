import { describe, expect, it } from 'vitest';
import { toolPath, TOOLS } from './tools';

describe('TOOLS manifest', () => {
  it('lists all nine shipped tools', () => {
    expect(TOOLS).toHaveLength(9);
  });

  it('has unique, well-formed slugs', () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('has a name and a one-line hook for every tool', () => {
    for (const tool of TOOLS) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.hook.length).toBeGreaterThan(0);
      // Hooks are fragments, not sentences — the 404 page renders them inline.
      expect(tool.hook.endsWith('.')).toBe(false);
    }
  });

  it('builds tool paths under /tools/', () => {
    expect(toolPath(TOOLS[0]!)).toBe(`/tools/${TOOLS[0]!.slug}`);
  });

  it('is ordered newest-first (Pastewright shipped last)', () => {
    expect(TOOLS[0]!.slug).toBe('pastewright');
    expect(TOOLS[TOOLS.length - 1]!.slug).toBe('invisible-characters');
  });
});
