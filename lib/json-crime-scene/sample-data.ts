/**
 * A compact but deliberately interesting built-in sample so the tool is useful
 * the moment it loads. It is generic synthetic API data (an orders response) —
 * nothing sensitive, nothing real.
 *
 * It is stored as literal JSON *source text*, not a JavaScript object, on purpose:
 * a duplicate key cannot survive being written as an object literal (the earlier
 * value is gone before the code runs), so the duplicate-key demonstration only
 * works from raw text. Reading top to bottom, the sample contains:
 *
 *   - `orders`: five mostly-consistent objects …                    → array-of-objects
 *   - one order missing `currency`                                  → inconsistent object shapes
 *   - one order whose `amount` is a string, not a number           → inconsistent field types
 *   - `note`, null on four of five orders                          → frequently-null field
 *   - `config.status` written twice in one object                  → duplicate object keys
 *   - `retryLimit`, an integer past 2^53                           → number outside the safe range
 *   - `customerId` beside `customerID`                             → case-only key collision
 *   - `tags`: a number, a string, and a boolean                    → mixed element types
 *   - `labels: []` and `meta: {}`                                  → empty structures
 *   - a key and a value each carrying a zero-width space (U+200B)  → unusual characters
 *
 * The tests in `sample.test.ts` assert that these are surfaced.
 */

export const SAMPLE_FILENAME = 'orders-response.json';

// NOTE: `\\u200b` in this template literal produces the two-character escape
// sequence `​` in the JSON source (legible), which the parser then decodes
// to a real U+200B ZERO WIDTH SPACE — exactly what the diagnostics detect.
export const SAMPLE_JSON = `{
  "service": "orders-api",
  "generatedAt": "2026-08-13T09:00:00Z",
  "page": { "number": 1, "size": 5, "totalPages": 3 },
  "orders": [
    { "id": 5001, "customer": "Ada Lovelace", "amount": 42.5, "currency": "USD", "status": "paid", "note": null },
    { "id": 5002, "customer": "Grace Hopper", "amount": 88, "currency": "USD", "status": "paid", "note": null },
    { "id": 5003, "customer": "Alan Turing", "amount": 120, "currency": "EUR", "status": "refunded", "note": "manual review" },
    { "id": 5004, "customer": "Katherine Johnson", "amount": 76, "status": "paid", "note": null },
    { "id": 5005, "customer": "Linus Torvalds", "amount": "unknown", "currency": "USD", "status": "pending", "note": null }
  ],
  "config": {
    "status": "open",
    "status": "closed",
    "retryLimit": 9223372036854775807,
    "customerId": 7,
    "customerID": 8,
    "tags": [1, "priority", true],
    "labels": [],
    "meta": {}
  },
  "\\u200bhidden": "a value with a \\u200b zero-width space"
}
`;
