export function pdfLinks(value) {
  const original = typeof value === 'string' ? value.trim() : '';
  const fallback = { preview: original, open: original, download: original };
  try {
    const url = new URL(original);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return fallback;
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
      || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
    if (!id || !/^[\w-]+$/.test(id)) return fallback;
    const resourceKey = url.searchParams.get('resourcekey');
    const makeUrl = path => {
      const result = new URL(path, 'https://drive.google.com');
      if (resourceKey) result.searchParams.set('resourcekey', resourceKey);
      return result;
    };
    const download = makeUrl('/uc');
    download.searchParams.set('export', 'download');
    download.searchParams.set('id', id);
    return {
      preview: makeUrl(`/file/d/${id}/preview`).href,
      open: makeUrl(`/file/d/${id}/view`).href,
      download: download.href,
    };
  } catch {
    return fallback;
  }
}
