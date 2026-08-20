import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, pageMetadata, SITE_NAME, siteUrl } from './meta';

const ENV_KEY = 'NEXT_PUBLIC_SITE_URL';
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe('siteUrl', () => {
  it('falls back to localhost when the env var is unset', () => {
    delete process.env[ENV_KEY];
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('falls back when the env var is blank', () => {
    process.env[ENV_KEY] = '   ';
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it('uses the configured origin', () => {
    process.env[ENV_KEY] = 'https://oddments.example.com';
    expect(siteUrl()).toBe('https://oddments.example.com');
  });

  it('strips trailing slashes so joined paths never double up', () => {
    process.env[ENV_KEY] = 'https://oddments.example.com//';
    expect(siteUrl()).toBe('https://oddments.example.com');
  });

  it('always yields a parseable URL', () => {
    delete process.env[ENV_KEY];
    expect(() => new URL(siteUrl())).not.toThrow();
  });
});

describe('pageMetadata', () => {
  const meta = pageMetadata({
    name: 'Date Goblin',
    description: 'A local-first date/time interpreter.',
    path: '/tools/date-goblin',
  });

  it('sets the bare name as the title (the layout template adds the suffix)', () => {
    expect(meta.title).toBe('Date Goblin');
  });

  it('sets the description', () => {
    expect(meta.description).toBe('A local-first date/time interpreter.');
  });

  it('declares a self-canonical path', () => {
    expect(meta.alternates?.canonical).toBe('/tools/date-goblin');
  });

  it('builds a complete Open Graph block with the full title', () => {
    expect(meta.openGraph).toMatchObject({
      title: `Date Goblin · ${SITE_NAME}`,
      description: 'A local-first date/time interpreter.',
      url: '/tools/date-goblin',
      siteName: SITE_NAME,
    });
  });

  it('carries the shared social image (shallow metadata merge would drop it)', () => {
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: '/opengraph-image', width: 1200, height: 630 }),
    ]);
  });
});
