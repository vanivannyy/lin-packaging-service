// Design prepress disimpan sebagai LINK OneDrive/SharePoint (bukan file upload) - lihat TRD keputusan stakeholder.
const ALLOWED_HOSTS = ["1drv.ms", "onedrive.live.com", "onedrive.com", "sharepoint.com"];

export function normalizeDesignLink(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Link design tidak valid.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Link design harus diawali https://");
  }
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    throw new Error("Link design harus berasal dari OneDrive/SharePoint (1drv.ms, onedrive.live.com, sharepoint.com).");
  }
  return url.toString();
}
