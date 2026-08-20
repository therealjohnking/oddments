import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toolPath, TOOLS } from '@/lib/site/tools';
import NotFound from './not-found';

describe('NotFound', () => {
  it('offers a way home', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /back to all the instruments/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('links every tool as a quick escape', () => {
    render(<NotFound />);
    for (const tool of TOOLS) {
      expect(screen.getByRole('link', { name: tool.name })).toHaveAttribute('href', toolPath(tool));
    }
  });
});
