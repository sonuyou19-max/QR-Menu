/**
 * When a login link is expired or already used, Supabase sends the owner back with
 * `#error=…&error_code=otp_expired` in the address. Read it once at start-up (before the
 * redirect to /login drops it) and clean the address bar.
 */
function readLinkError(): boolean {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("error") && !params.has("error_code")) return false;
  history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  return true;
}

export const loginLinkFailed = readLinkError();
