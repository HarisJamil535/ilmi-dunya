export function initialPage() {
  if (typeof document === "undefined") return null;
  const node = document.getElementById("public-page-data");
  if (!node) return null;
  try {
    const data = JSON.parse(node.textContent);
    return data.requestPath === window.location.pathname + window.location.search ? data : null;
  } catch { return null; }
}

export function applyMetadata(meta) {
  if (!meta) return;
  const origin = import.meta.env.VITE_SITE_URL || window.location.origin;
  const canonical = new URL(meta.path, origin).href;
  const set = (selector, attributes) => {
    let node = document.head.querySelector(selector);
    if (!node) { node = document.createElement(selector.startsWith("link") ? "link" : "meta"); document.head.appendChild(node); }
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  };
  document.title = meta.title;
  set('meta[name="description"]', { name: "description", content: meta.description || "" });
  set('meta[name="robots"]', { name: "robots", content: meta.indexable ? "index, follow" : "noindex, follow" });
  set('link[rel="canonical"]', { rel: "canonical", href: canonical });
  for (const [key, value] of Object.entries({ title: meta.title, description: meta.description || "", url: canonical, type: meta.article ? "article" : "website", image: meta.image ? new URL(meta.image, origin).href : new URL("/logo.png", origin).href })) {
    set(`meta[property="og:${key}"]`, { property: `og:${key}`, content: value });
  }
  for (const [key, value] of Object.entries({ title: meta.title, description: meta.description || "", image: meta.image ? new URL(meta.image, origin).href : new URL("/logo.png", origin).href })) set(`meta[name="twitter:${key}"]`, { name: `twitter:${key}`, content: value });
}
