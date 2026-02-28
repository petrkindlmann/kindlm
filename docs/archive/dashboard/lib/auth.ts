const COOKIE_NAME = "klm_token";
const MAX_AGE_DAYS = 30;

/** Read the auth token from the `klm_token` cookie. Returns `null` when absent. */
export function getToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/** Persist the auth token as a cookie that lasts 30 days. */
export function setToken(token: string): void {
  if (typeof document === "undefined") return;

  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Remove the auth token cookie. */
export function clearToken(): void {
  if (typeof document === "undefined") return;

  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
