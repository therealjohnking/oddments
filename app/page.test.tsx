import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toolPath, TOOLS } from '@/lib/site/tools';
import HomePage from './page';

describe('HomePage', () => {
  it('renders a card for every tool, in manifest (newest-first) order', () => {
    render(<HomePage />);
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((href): href is string => href !== null && href.startsWith('/tools/'));
    expect(hrefs).toEqual(TOOLS.map(toolPath));
  });

  it('names every tool on its card', () => {
    render(<HomePage />);
    for (const tool of TOOLS) {
      expect(screen.getByText(tool.name)).toBeInTheDocument();
    }
  });

  it('links to the About page from the laboratory note', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: /more about the lab/i })).toHaveAttribute(
      'href',
      '/about',
    );
  });
});
