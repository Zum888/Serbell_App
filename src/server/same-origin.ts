/** A browser cannot forge Sec-Fetch-Site. same-origin and none are this lab; cross-site is not. */
export function requestIsSameOrigin(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (site === "same-origin" || site === "none") return true;
  if (site === "cross-site" || site === "same-site") return false;

  const host = headers.get("host")?.trim().toLowerCase();
  if (!host) return false;
  const claimed = headers.get("origin") ?? headers.get("referer");
  if (!claimed) return false;
  try {
    return new URL(claimed).host.toLowerCase() === host;
  } catch {
    return false;
  }
}
