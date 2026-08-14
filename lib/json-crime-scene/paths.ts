/**
 * Path helpers. JSON Pointer (RFC 6901) is the primary, standards-oriented way
 * to name a node; a JavaScript-style dot/bracket path is offered as a secondary
 * convenience with correct escaping (never pretending an awkward key is safe as
 * a bare `.property`).
 */

/**
 * Encode one path segment as an RFC 6901 reference token. The escaping is
 * order-sensitive: `~` becomes `~0` first, then `/` becomes `~1`, so that a
 * literal `~1` in a key never round-trips into a `/`.
 */
export function encodePointerToken(segment: string | number): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Decode one RFC 6901 reference token back to its literal member name. */
export function decodePointerToken(token: string): string {
  // Decode `~1`→`/` before `~0`→`~`, the reverse order of encoding.
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Build a JSON Pointer from path segments. The empty path is the root: ''. */
export function toJsonPointer(path: (string | number)[]): string {
  if (path.length === 0) return '';
  return '/' + path.map(encodePointerToken).join('/');
}

/** Parse a JSON Pointer into its decoded segments (root '' → []). */
export function fromJsonPointer(pointer: string): string[] {
  if (pointer === '') return [];
  // A valid pointer starts with '/'. Drop the leading empty segment.
  return pointer.split('/').slice(1).map(decodePointerToken);
}

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Build a JavaScript-style accessor path (e.g. `orders[3].customer.name`). Keys
 * that are valid identifiers use dot notation; everything else (spaces, dashes,
 * digits-first, empty, quotes, non-ASCII, `/`, …) uses bracket notation with a
 * JSON-quoted string, so the path is always syntactically honest.
 *
 * `rootLabel` (default '$') names the document root and is only emitted when the
 * path is empty or begins with an array index, so array roots read as `$[0]`
 * while object roots read as `name` / `["odd key"].sub` without a noisy prefix.
 */
export function toJsPath(path: (string | number)[], rootLabel = '$'): string {
  if (path.length === 0) return rootLabel;

  let out = '';
  path.forEach((segment, i) => {
    if (typeof segment === 'number') {
      // A leading key that is itself equal to `rootLabel` (e.g. a property named
      // "$") must not be emitted bare, or it would be indistinguishable from the
      // root — bracket-quote it instead.
      out += `[${segment}]`;
    } else if (JS_IDENTIFIER.test(segment) && segment !== rootLabel) {
      out += i === 0 ? segment : `.${segment}`;
    } else {
      out += `[${JSON.stringify(segment)}]`;
    }
  });

  // Prefix the root label when the path leads with an array index (so a top-level
  // `[0]` isn't left hanging) or with a key equal to the root label (so `$["$"]`
  // is distinct from the bare root `$`). A leading bracketed *key* otherwise is
  // already an unambiguous access on the root and needs no prefix.
  const leadingIndex = typeof path[0] === 'number';
  const leadingRootKey = path[0] === rootLabel;
  return leadingIndex || leadingRootKey ? `${rootLabel}${out}` : out;
}
