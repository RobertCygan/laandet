/**
 * The page feedback was sent from: a same-site path only, without query or fragment (they can hold a token).
 * Shown to staff as text, never as a link.
 */
export function cleanPagePath(value?: string | null): string | null {
  const path = value?.trim().split(/[?#]/)[0];
  return path && /^\/[\w\-/.]{0,299}$/.test(path) ? path : null;
}
