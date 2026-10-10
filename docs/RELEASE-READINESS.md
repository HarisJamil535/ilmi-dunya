# Release readiness - 2026-10-10

## Fixed in this audit

- Academic deletion and reassignment could leave linked chapters, questions or test history orphaned. Added dependency guards and explicit 409 feedback.
- Subject/chapter writes now validate names, chapter numbers and academic relationships. Invalid filter IDs return 400 instead of an internal error.
- Rapid filter changes could display an earlier request's response. Cancel obsolete requests and provide retry controls on subjects/chapters.
- Optional answer-sheet requests no longer delay displaying chapters.
- Sidebar now reuses shared study options rather than issuing three redundant requests.
- Successful student writes no longer invalidate public SSR, sitemap and options caches. Content changes still invalidate these caches.
- Updated compatible dependencies and separated development utilities from runtime dependencies.

## Verification

- Backend: 56 tests passed, including authorization, publishing, scoring, uploads and new integrity/cache regression coverage.
- Client lint and production client/SSR build passed.
- Browser/SEO smoke suite passed: public initial HTML, canonicals, redirects, 404s, private noindex, sitemaps, news navigation and responsive rendering.
- Public layouts checked at 375, 768 and 1440px. Fifteen admin routes checked at 375 and 1440px with fixture API responses; no horizontal overflow or uncaught browser errors.
- Production dependency audit: zero known findings. Nine high-severity development-tool findings remain; no forced breaking upgrades applied.
- No live database writes or production load tests performed. Browser checks with fixtures do not certify every live publishing, email, payment-provider or hosting interaction.

## Before bulk uploading

1. Deploy these changes; this audit did not push or deploy them.
2. Back up the database and uploaded files. Ensure Hostinger preserves `server/uploads` across deployment and restart, or configure durable object storage before relying on local uploads.
3. With the correct production environment configured, run `npm --prefix server run indexes` once during a maintenance window. It creates declared indexes without dropping existing ones. Resolve any reported duplicate-record conflicts; never delete data automatically to make it pass. This audit did not run it against production.
4. On the deployed site, create one real subject/chapter/topic and upload one book, note, paper and question image. Verify student visibility, editing and authorized deletion. Restart/redeploy once and confirm the files remain available.
5. Verify real registration, password-reset email, test submission and leaderboard updates using a dedicated test student. Keep that account out of public competition data where applicable.
6. Rotate credentials previously shared in screenshots or messages. Do not commit `.env` files.

No existing records were migrated or rewritten. These checks reduce known risks; they do not guarantee a bug-free application or production response times on every network.
