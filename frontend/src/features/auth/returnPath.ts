const allowedPathPrefixes = ["/shop", "/cart", "/account", "/staff"];

export function resolveReturnPath(candidate: string | null, fallback: string) {
  if (candidate === null || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  if (decoded.startsWith("//") || decoded.includes("\\") || decoded.startsWith("/account/access")) {
    return fallback;
  }

  const pathname = decoded.split(/[?#]/, 1)[0];
  const supported = pathname === "/" || allowedPathPrefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
  return supported ? decoded : fallback;
}
