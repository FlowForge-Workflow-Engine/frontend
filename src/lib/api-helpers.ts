/**
 * API Helpers — Unwrap standard API response wrappers.
 */

/** Unwrap a single-item response: { data: { data: T } } → T */
export const unwrap = <T>(response: { data: { data: T } }): T => response.data.data;

/** Unwrap a list response: { data: { data: T[], count: number } } → { items, count } */
export const unwrapList = <T>(response: { data: { data: T[]; count: number } }) => ({
  items: response.data.data,
  count: response.data.count,
});
