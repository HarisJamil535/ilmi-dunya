# IlmiDunya SEO and reliability handoff

## Status

Implementation and isolated verification are complete for the changes below. This is not a claim that every possible defect is eliminated or that deployment has been verified. The configured MongoDB connection returned `ECONNREFUSED`; no live database records were changed, no indexes were created against it, and no production deployment was performed.

## Prioritized findings and fixes

| Priority | Confirmed finding | Impact and implemented fix | Main files |
| --- | --- | --- | --- |
| P1 | Public content initially depended on an empty React root; canonical URLs pointed to a fixed homepage/domain | Express now renders public home, news, article and study-library HTML, then React hydrates the same views. Per-page metadata replaces fixed tags. | `server/src/routes/publicPagesRoutes.js`, `server/src/services/seoDocument.js`, `client/src/entry-server.jsx`, `client/src/main.jsx` |
| P1 | Curriculum discovery relied heavily on buttons/query filters; generic sitemap did not enumerate published content | Added linked board/class/subject/chapter/topic/resource pages under `/learn`, stable ID-plus-slug URLs, old-slug redirects, sitemap index and bounded child sitemaps. Existing study-tool URLs remain supported and noindex. | `server/src/services/publicPages.js`, `client/src/student/pages/PublicStudyPage.jsx`, `client/src/student/components/SubjectCard.jsx` |
| P1 | Download restrictions were only a client-side button condition | Book/notes metadata stays public, but API file URLs now require a valid student session or an admin with resource access. Public study HTML never includes those URLs. | `server/src/middleware/resourceReader.js`, `server/src/controllers/resourceController.js`, `client/src/api/axios.js`, book/notes viewers |
| P1 | Student reset tokens remained valid after a password reset; reset consumption was not atomic | Added token versions and atomic one-time password reset updates. Admin reset also atomically clears its device session. Both reset endpoints have rate limits. | student/admin authentication controllers and middleware, `server/src/models/Student.js`, `server/server.js` |
| P2 | News list omitted body text, but editing used that list object; updates could reset publication date | Editing fetches the complete article. Server whitelists fields, keeps original publication date and stable slug, validates content/cover descriptions, and rejects duplicate URLs. | `client/src/admin/pages/NewsManagement.jsx`, `server/src/controllers/newsController.js`, `server/src/services/publishing.js` |
| P2 | Publishing forms lacked original descriptions, sources and URL guidance | Shared labelled publishing fields now support books, notes, papers, tests and academic/topic editors, with examples and a search preview. New resource publishing requires an original summary. | `client/src/admin/components/PublishingFields.jsx`, affected admin pages/modals, `server/src/middleware/publishingMiddleware.js` |
| P2 | Uploads trusted image MIME types/extensions | News uploads are limited to 3 MB, allowed raster types and matching byte signatures, with generated filenames. SVG/HTML uploads are rejected. | `server/src/routes/newsRoutes.js`, `server/src/services/imageUpload.js` |
| P2 | Optional admin access and client token handling could use the wrong authentication context | Admin readers verify role, current device session and permission. Axios sends the appropriate account token and does not clear login on a permission-only 403. Inactive home-content management lists require admin access. | auth middleware, optional admin middleware, Axios, home-content routes |
| P2 | News browsing was unbounded; returning to a category could remain loading | Bounded API pagination, public crawlable previous/next links, admin paging, cancellation and retry states. | news controller, student/admin news pages |
| P2 | Static assets inherited the API CORS policy in the new combined deployment | CORS now applies to API requests, with the configured public origin accepted. Hashed assets use immutable caching. | `server/server.js`, public routes |
| P2 | Dependency audit reported known frontend vulnerabilities | Applied compatible dependency updates, without a forced major-version migration. | `client/package-lock.json` |
| P3 | Footer contained placeholder social/contact links and unavailable policy routes | Removed fabricated destinations. Verified contact/social/policy URLs can be configured; board links use actual records. | Footer, `client/.env.example` |

## Architecture and indexing policy

- React/Vite, Express and Mongoose remain in place. There is no Next.js migration and no replacement admin interface.
- The production web entry point is Express, not a static-only deployment of `client/dist`. It uses both `client/dist` and `client/dist-server`.
- Server-rendered public data is cached for 30 seconds in a bounded, per-process cache. Successful API writes invalidate that process's cache. Other instances converge within the TTL.
- `/learn/{kind}/{ObjectId}/{slug}` keeps identity separate from readable titles. Resource slug changes redirect using the unchanged ID; news slugs are immutable once saved.
- Academic pages contain real inventory and optional original introductions. Resource pages show original summaries, academic context, sources and actual file/test information. Topic pages can show published written questions and link to MCQs/videos.
- Thin resources remain usable but are noindex and excluded from resource sitemaps. The 80-character summary check is a publishing completeness rule, not a Google ranking target. Editorial review is still essential.
- Sitemaps are conservative: legacy curriculum pages without curated summaries can be discovered through the linked study directory even when omitted from the sitemap. Parent context is checked before resource sitemap inclusion.
- Login, admin, dashboard, test-taking and query-driven study-tool pages are noindex. Public filter variations use canonical metadata; category-filtered news is noindex. XML includes only suitable public content, not students or attempts.
- Breadcrumb and article structured data describe actual pages. No fabricated ratings, FAQ rich-result claims or unsupported video markup were added.
- Public video discovery currently comes through its topic page and lesson link. Video rich-result eligibility requires real thumbnail, upload-date and duration metadata and is not claimed here.

## Database and API changes

- Added optional publication fields to Subject, Chapter, Topic, Book, ChapterNote, PastPaper and Assessment: summary, slug, source name/URL, edition, filename, image description and tags. Existing ObjectId relationships are unchanged.
- News adds cover alternative text, sources/tags and a published-date listing index. Its existing unique slug remains the identity.
- Student password is excluded by default; `tokenVersion` defaults to zero for old accounts. Existing version-zero tokens remain valid until reset/expiry.
- Added a compound Question index matching public topic/status/content-type queries. Existing indexes remain intact.
- Book creation no longer silently replaces the book for the same academic context: use Edit; duplicate context returns a conflict. Notes retain the existing one-note-per-type/chapter update behavior.
- Resource writes verify the subject belongs to the chosen board/class/group. Tests validate scope, selected MCQs, question counts, duration and passing marks; protected ownership/totals cannot be supplied arbitrarily.
- Resource failures use actionable 400/404/409 responses rather than exposing database errors. Invalid resource filter IDs are rejected rather than ignored.
- Book/notes API consumers must send a valid account token to receive `pdfUrl`. Past-paper reading remains public. Existing public third-party PDF addresses cannot be made private retroactively; use private storage and signed URLs if revocable file access is required.

## Verification performed

- `npm run build`: client and server-renderer builds passed.
- `npm run lint`: passed.
- `npm test`: 28 tests passed, including existing scoring, ranking, chapter/topic scope and scenario tests; new authorization, publishing, upload-signature, metadata and sitemap tests.
- All 73 JavaScript files under `server/src` passed Node syntax checks.
- `npm run test:seo`: passed against isolated fixtures, without MongoDB. Verified initial HTML headings, canonical uniqueness, sitemap/robots responses, true 404s, old-slug 301s, noindex private pages, news pagination/category navigation and client navigation.
- Browser checks covered home, study library, news and article pages at 375, 768 and 1440 px; authenticated-header hydration and book/news admin forms at 375 and 1440 px. No tested viewport overflow or browser runtime errors. These are representative checks, not exhaustive device certification.
- Both server production dependency audit and the final client production dependency audit reported zero known vulnerabilities. The client full audit also reported zero after compatible updates.
- Measurements/screenshots: `artifacts/seo/`. The final fixture run observed LCP 0.50-2.13 seconds and CLS approximately zero on these local, unthrottled pages. These are not field Core Web Vitals, a Lighthouse certification, or production load-test results. Cold SSR import was included in the approximately 629 ms first homepage response; subsequent sampled page responses were 35-201 ms with fixture queries.
- Initial main client bundle baseline was approximately 105.97 KB gzip; the new build remains roughly 108 KB gzip. The gain is meaningful initial HTML and avoided duplicate initial requests, not a claim of a smaller JS bundle. No defensible production before/after latency comparison is available.
- Existing Mongoose tests emit a `validateSync` deprecation warning; they pass. This should be updated before a future Mongoose 10 migration.

## Deployment steps

1. Restore MongoDB access first: check `MONGODB_URI`, the database service, network/firewall and any Atlas allowlist. Use staging data to test complete create/edit/delete, login, email reset and assessment flows before public release.
2. Install lockfile dependencies with `npm ci --prefix client` and `npm ci --prefix server`. Use a supported Node runtime compatible with the Vite/Mongoose versions; checks here used Node 24.
3. Set `server/.env`: `NODE_ENV=production`, your actual HTTPS origin in `SITE_URL` and `CLIENT_ORIGIN`, a random `JWT_SECRET` of at least 32 characters, MongoDB URI and working SMTP settings. Do not put secrets in `VITE_*` variables.
4. Set client build variables: `VITE_API_URL=/api`, and `VITE_SITE_URL` identical to `SITE_URL`. Populate only verified optional footer URLs/contact details. No public domain was assumed or registered by this work.
5. Run `npm run build`, `npm run lint`, `npm test`, then `npm run test:seo`. Browser tests use installed Edge by default; set `PLAYWRIGHT_CHANNEL` appropriately for another installed Chromium channel.
6. Back up the database. Run `npm --prefix server run indexes` from the repository root. It adds declared indexes with `createIndexes`; it does not drop indexes or rewrite records. Resolve pre-existing duplicates if a unique-index build fails. No automatic destructive migration/backfill is required.
7. Deploy both build directories and keep server plus client runtime dependencies available for React SSR. Start with `npm start`; route the public domain, `/api`, `/assets`, `/uploads`, `/robots.txt` and sitemap paths to Express. Do not use Vite preview as the production server.
8. Configure HTTPS at the trusted reverse proxy. Set `TRUST_PROXY_HOPS` to the actual topology, not an arbitrary broad value. Keep uploaded news images on persistent storage and include them in backups. Restart the process after replacing builds.
9. Inspect deployed page source, status codes, canonical host, image/PDF accessibility and noindex rules. Test reset email delivery with real SMTP. Set monitoring for availability, failures, database latency and upload storage.

## Remaining launch work and limits

- Live database integrity, query plans, production throughput/concurrency, real email delivery and full data-backed CRUD could not be verified while MongoDB was unreachable. Do not infer production readiness from fixture tests alone.
- Existing legacy catalog/resource lists still use their established full-list API contracts. News and the new public listing pages are bounded. Further list pagination must update every consumer together; verify catalog sizes before changing those contracts.
- Rate limiting and page caching are per process. Use shared rate-limit storage and assess distributed invalidation for a multi-instance deployment. This implementation is not an unlimited-traffic guarantee.
- Review existing orphan references and duplicate content before index creation. No bulk rewrites were attempted without a database connection or backup.
- Confirm textbook/past-paper rights, original teacher descriptions, accurate edition/session labels, original images and attribution. Review admin-managed homepage stats/testimonials for evidence and consent.
- Supply owner-approved privacy/terms and contact destinations. Collecting student phone, school and city needs an appropriate privacy policy and retention controls; placeholder legal pages were not invented.
- JWTs still use the project's existing browser storage. Moving to HttpOnly cookies requires a separate coordinated CSRF/session migration; it was not silently introduced here.
- Image byte checks are not malware scanning or image recompression. Private signed storage, media processing, external PDF availability checks and automated storage cleanup remain hosting/content-operation concerns.
- Establish Google Search Console ownership, submit `/sitemap.xml`, inspect representative pages, monitor indexing and field Core Web Vitals, and improve pages using real search queries. Earn relevant links through useful original resources. No implementation can guarantee a number-one ranking.

Official references: [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
