// Turns a YouTube link into an address that can play inside the page; returns "" for anything else.
export function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = parsed.pathname.split("/")[1] || "";
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) id = parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] || "";
    if (!/^[\w-]{6,20}$/.test(id)) return "";
    const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1", autoplay: "1" });
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
  } catch { return ""; }
}
