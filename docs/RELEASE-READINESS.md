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

# Audit fixes - 2026-10-21

## Changed

- **Super admin creation** no longer has a built-in password. Run `npm --prefix server run create-super-admin` with `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (12+ characters, letters and numbers) set only for that command. If `admin@ilmidunya.com` was ever created with the old default password, change that password now.
- **Test settings are enforced**: opening/closing times (attempts end at the closing time), allowed attempts, question shuffling, option shuffling (options are relabelled A-D per attempt; grading still uses the stored keys), and "show result after submission". Withheld results hide score and answer keys from students and stay off the leaderboard until an admin turns the setting back on. All settings are in the MCQ Test Builder under "Test settings".
- **Generated chapter/topic tests** are only rewritten when their published content changes, and a unique partial index prevents duplicates. Run `npm --prefix server run indexes` once after deploying; it now reports every model with conflicting records instead of stopping at the first.
- **Subject and news images** upload to MongoDB GridFS (`/api/media/images/:id`) so they survive redeploys and are included in database backups. Existing `/uploads/...` images keep working; keep that folder until those images are re-uploaded.
- **Admin password reset codes** are now keyed with `JWT_SECRET`. Codes requested before this deploy stop working; request a new one.
- **Site visit counter** ignores crawlers and stops counting after 60 visits per address in 15 minutes. `TRUST_PROXY_HOPS` must match the hosting proxy, or every visitor shares one address.
- Deleting a board, class, group or subject clears it from student profiles. Admin menus only show sections the admin has permission for. A failed connection no longer signs admins out. The student dashboard shows a real day streak and weakest topics, and offers a retry if loading fails.
- Removed unused code: the random test builder endpoint, rate limits for non-existent routes, `mockDatabase.js` and commented-out controller code.

## Not changed (needs a hosting decision)

- Rate limits and the public page cache are per process. Multiple server instances need a shared store such as Redis.
- Student and admin tokens are still in browser storage. Moving to HttpOnly cookies needs a coordinated CSRF/session migration.

# Schools, result cards and school reports - 2026-10-22

## What was added

- **School choice at signup.** Students pick their school from a list that admins manage. A listed school asks for a class, then a section (each only when the admin has added any). "My school is not listed" shows a text box; "Private Student" asks for nothing more. Students can correct their choice later from the dashboard ("Edit school, class and section"); this is also how existing students join a school list.
- **Admin: Schools** (`/admin/schools`). Add schools, classes and sections (comma separated names are accepted, e.g. `Section A, Section B`). Renaming updates the students who belong to it. Items that students belong to cannot be deleted; schools can be hidden from signup instead.
- **Admin: School Results** (`/admin/school-results`). Choose a school (all schools, whole school, one class or one section) and optional start and end dates (Pakistan time, both days included). The page shows totals and every attempt; "Download Excel" gives a Summary sheet, a Students sheet (attempts, passed, average, best, total time, first and last attempt, including students with no attempts) and an Attempts sheet (date, start and submit time, time taken, marks, percentage, result, how it ended, whether it was a shorter practice set).
- **Student result card PDF.** "Download result card" on the dashboard: student and school details, totals, every completed test with date, time, marks, percentage and result, and an IlmiDunya verification stamp. Results that an admin is still withholding show as "Pending" and are left out of the averages.
- New admin permission **"Schools & School Results"** (super admins have it automatically). Give it to other admins under Admin Management.

## Deploying

1. `npm ci --prefix server` (new dependency: `pdfkit`; the root and server lockfiles are updated).
2. Run `npm --prefix server run indexes` once. It adds three indexes (unique school names, student school/class/section, and student/date on attempts); no existing data is changed.
3. Add the schools, classes and sections before announcing the change. Students who registered earlier have no school link until they choose one from their dashboard, so they do not appear in school reports yet.

## Limits

- Excel downloads are capped at 30,000 attempts; the admin is asked to choose a class, section or shorter dates. Workbooks are built on a worker thread so large downloads do not slow the site for others.
- Result cards list the latest 300 tests (totals cover up to the latest 2,000).
- The PDF uses built-in Latin fonts. Names or titles in other scripts (for example Urdu) print as "?" instead of corrupt glyphs; supporting them needs an embedded Urdu font.
- The school list is cached for 30 seconds per server process.
