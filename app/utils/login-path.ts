export function loginPath(redirect: string): string {
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
