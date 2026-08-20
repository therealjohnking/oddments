/**
 * Cloudflare Web Analytics — the entire analytics surface of Oddments.
 *
 * Deliberately minimal: a cookieless page-view beacon, compiled in only when
 * NEXT_PUBLIC_CF_BEACON_TOKEN is set at build time. Without the token this
 * component renders nothing and the page ships zero analytics code.
 *
 * What it measures: page views per route (which is per tool), referrer,
 * country, and broad browser/device class. What it can never see: anything
 * typed, pasted, or dropped into a tool — the beacon only reports navigation,
 * and no Oddments code sends tool input or output anywhere. That invariant is
 * architectural; see the Privacy page and README.
 *
 * The beacon also observes client-side (SPA) navigations, so moving between
 * tools without a full reload still counts per-tool views.
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
