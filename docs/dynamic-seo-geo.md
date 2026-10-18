# Dynamic SEO and crawler configuration

Production origin: set `SITE_URL=https://ilmidunya.org` on the server. If needed,
set `VITE_SITE_URL=https://ilmidunya.org` at frontend build time.

Submit https://ilmidunya.org/sitemap.xml to Search Console. The existing Express
router creates child maps at `/sitemaps/class/1.xml`, `/sitemaps/notes/1.xml`, etc.
Each map queries MongoDB in batches of 1,000. Only eligible public resources are
included; `lastmod` uses valid database `updatedAt` values. Filter/query URLs and
external URLs are excluded. Missing timestamps are omitted, never replaced with
the current time.

`server/src/services/robots.js` serves `/robots.txt`. Each named bot group repeats
the private-path and filter restrictions: named groups do not inherit `*` rules.
OAI-SearchBot, PerplexityBot, Claude-SearchBot, GPTBot and Google-Extended are
explicitly allowed on public pages. This includes training permission as requested.
Robots directives do not replace login checks or bypass Hostinger security rules.

## Reusable frontend component

`StructuredSEO` uses react-helmet-async 3 with React 19. It portals Helmet output
into the document head. Express emits equivalent JSON-LD in initial public HTML,
so crawling does not depend on JavaScript. Existing public pages use
`manageMetadata={false}` because their metadata is already managed centrally.
Canonical tags remove query strings and fragments; query pagination still works,
but its canonical points to the clean master page by explicit project policy.

```jsx
import StructuredSEO from '../seo/StructuredSEO';

<StructuredSEO origin="https://ilmidunya.org" page={{
  kind: 'chapter', // 'class' also emits Course; 'notes' emits LearningResource
  title: 'Computer Generations',
  educationalLevel: 'Class 9',
  summary: chapter.description,
  updatedAt: chapter.updatedAt,
  meta: {
    title: 'Computer Generations | IlmiDunya',
    description: chapter.description,
    path: '/learn/chapter/REAL_ID/computer-generations?filter=important',
  },
  faqs: visibleAccordionItems.map(item => ({
    question: item.question,
    answer: item.answer,
  })),
  videos: [{
    name: lesson.title,
    description: lesson.description,
    thumbnailUrl: lesson.thumbnailUrl,
    embedUrl: lesson.embedUrl,
    uploadDate: lesson.actualVideoUploadDate,
    duration: 'PT8M30S', // only when the actual duration is known
  }],
}} />
```

For notes, use `kind: 'notes'`, its real title, description and clean `/learn/notes/`
path. For topic accordions, pass only questions AND answers displayed on that
same page. Current question banks contain statements without answers, so they
do not automatically get FAQPage. Do not invent answers for schema.

Current video links do not record the video's actual upload date and thumbnail
metadata. The reusable builder supports VideoObject, but emits it only when
those facts are supplied together with an HTTP(S) embed/content URL. A topic's
database creation date is not the video's upload date. Do not use it as one.

Validate representative pages using Schema.org Validator and Google's Rich
Results Test; use View Source to confirm JSON-LD and a single clean canonical.
FAQ schema does not guarantee a Google FAQ rich result, and schema/crawler access
does not guarantee rankings or AI citations. Hostinger/CDN challenges must also
allow legitimate crawler requests to reach public pages.
