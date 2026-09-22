export const studyPath = (kind, item) => {
  const slug = item.slug || String(item.title || item.name || kind).normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
  return `/learn/${kind}/${item._id}/${encodeURIComponent(slug || kind)}`;
};
