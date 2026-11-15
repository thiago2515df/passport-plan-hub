export function setSupabaseAccessCookie(token?: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `ebx-sb-access-token=${encodeURIComponent(token)}; Path=/; Max-Age=3600; SameSite=Lax; Secure`;
  } else {
    document.cookie = "ebx-sb-access-token=; Path=/; Max-Age=0; SameSite=Lax; Secure";
  }
}
