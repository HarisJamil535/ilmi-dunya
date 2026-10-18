import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Helmet } from 'react-helmet-async';
import { cleanCanonical, educationalSchemas, schemaJson } from './structuredData.mjs';
const subscribe = () => () => {};
const getHead = () => document.head;
const serverHead = () => null;

// Express renders the same schemas in initial HTML; Helmet handles SPA updates.
export default function StructuredSEO({ page, origin, manageMetadata = true }) {
  const head = useSyncExternalStore(subscribe, getHead, serverHead);
  useEffect(() => {
    document.querySelectorAll('#study-resource-schema:not([data-seo-owned])').forEach(node => node.remove());
    if (manageMetadata) {
      document.head.querySelectorAll('link[rel="canonical"]:not([data-seo-owned]), meta[name="description"]:not([data-seo-owned])').forEach(node => node.remove());
    }
  }, [manageMetadata]);
  if (!head) return null;
  const site = origin || import.meta.env.VITE_SITE_URL || window.location.origin;
  const canonical = cleanCanonical(page.meta?.path || window.location.pathname, site);
  const schemas = page.structuredData || educationalSchemas(page, site);
  return createPortal(<Helmet>
    {manageMetadata && <title>{page.meta?.title || page.title}</title>}
    {manageMetadata && <meta data-seo-owned="true" name="description" content={page.meta?.description || page.summary || ''} />}
    {manageMetadata && <link data-seo-owned="true" rel="canonical" href={canonical} />}
    {schemas.length > 0 && <script data-seo-owned="true" id="study-resource-schema" type="application/ld+json">{schemaJson(schemas)}</script>}
  </Helmet>, head);
}
