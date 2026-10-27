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

# QA and load-test round - 2026-10-23

Tested against a real MongoDB 7, the real server build, a real browser (Chromium at phone and desktop widths) and a local mail server, with about 480 automated checks across signup, sign-in, forgot password, tests, result cards, school management, school reports, permissions and security, plus load tests with 300 students acting at the same instant.

## Problems found and fixed

- **Sign-in froze the whole website.** Passwords were checked with a pure-JavaScript bcrypt that blocks the server for about 0.4 s each, so 20 sign-ins at once froze every page for 7 s and 300 would have frozen it for minutes. Passwords now use scrypt on worker threads (about 50 ms, the site stays responsive). Existing accounts keep working and are upgraded automatically the next time they sign in. Unknown accounts take as long to reject as wrong passwords.
- **A school could not sign up or sign in together.** Limits were per IP address (10 signups and 40 sign-ins per 15 minutes), but a whole school shares one IP. Failed sign-ins are now limited per account (10 per account per address, 30 per account overall) and signups 150 per address; correct sign-ins are never counted. Admin sign-in and reset codes have their own per-account limits.
- **Double-clicking "Start test" created two attempts** (and could bypass an "attempts allowed" limit). Starts are now serialised per student and test.
- **`GET /api/attempts/:id` always failed** with "Please choose a valid item".
- **CORS rejected the site's own address** when it differed from `CLIENT_ORIGIN` (for example `www.` versus no `www.`), which breaks signup and sign-in with "Not allowed by CORS". The site's own host is now always accepted; other origins still must be listed.
- **Heavy public lists were slow under load** (subjects, chapters, boards, classes, groups, topics, home content: about 500 requests per second). They are now cached for 20 seconds and cleared the moment an admin changes content (about 2,000 per second).
- **Database outage**: the site answers 503 instantly for a few seconds instead of making every visitor wait 10 s, and recovers by itself when the database returns. `/health` also triggers the reconnect.
- **Deploys**: the server now finishes running requests on SIGTERM and keeps connections open longer than proxy idle timeouts, which prevents sporadic 502 errors.
- Large PDF and Excel jobs run a few at a time so a burst cannot use all memory.
- Dependencies with known advisories were updated (nodemailer, ip-address, vite, follow-redirects). `npm audit --omit=dev` reports 0 for root, server and client.
- Mongoose `new: true` deprecation warnings removed.

## Results with 300 students starting together (4-core test machine, database on the same machine)

- Sign in, dashboard, start test, answer, submit, result, result card, leaderboard: 300 of 300 succeeded, with distinct IPs or one shared IP.
- Sign-in median 3.3 s and slowest 6 s when all 300 sign in at the very same second (the password work is queued on worker threads); the site stayed responsive throughout (health check 95th percentile about 110 ms). Later steps took 0.1 to 4.5 s each.
- Cached public pages sustained roughly 2,000 to 3,000 requests per second with 300 open connections.
- Memory peaked near 480 MB without a limit and 283 MB with `NODE_OPTIONS=--max-old-space-size=200`, then settled near 290 MB (no leak across repeated runs).

## Set these on the host

- `TRUST_PROXY_HOPS=1` behind one proxy (Render, Hostinger, nginx). Without it every visitor looks like the proxy's IP and per-address limits no longer separate users.
- On a 512 MB plan add `NODE_OPTIONS=--max-old-space-size=300`.
- Email: every signup and reset sends a code. Free email plans cap daily sends (for example Resend's free plan allows 100 a day), so 300 students signing up in a day need a paid plan or a larger SMTP allowance.

## Known limits (not changed)

- Rate limits and caches live in each server process. Several server instances need a shared store (Redis); the keyed start lock has the same limit.
- Two signups with the same phone number at the same instant can both succeed (email is protected by a unique index). The sign-in then asks for the email address.
- An attempt that was started and never finished stays "in progress" after its time ends until the student opens it again; it is then graded on the saved answers.
- Names, cities and schools of the top leaderboard entries are public by design.
- Browser sign-in tokens are kept in browser storage (a cookie-based session would need a separate change).

# QA round: real users, bad networks and 500 students at once

## Fixed in this round

- **Answers on a weak connection.** An answer that failed to save (a dropped or slow connection) was removed again and the student had to pick it a second time; while one answer was saving the other options were locked. The test page now shows the choice at once, keeps unsent answers on the device (they survive a reload), retries until the server has them and resends after reconnecting. Its status line reads "Saving...", "All answers saved" or "Connection lost. Keep answering...".
- **Offline popup during a test.** The full-screen "trouble connecting" dialog covered the answer buttons on phones. During a test the page now shows its own inline message instead.
- **Submitting with unsent answers.** A submit (including the automatic one when the student leaves the page, which cannot wait for a second request) now carries any answers not yet sent. The server checks each one (option exists, question belongs to the attempt, time not over) before grading. Submitting while offline closes the confirmation and explains that the answers are kept.
- **Lighter pages.** The home hero image is WebP (186 KB to 53 KB, 27 KB on phones), the logo is a 4 KB WebP and the browser icon a 4 KB PNG instead of the 61 KB logo. The home page now transfers 256 KB instead of 472 KB; on slow 3G it loads in about 6 s instead of 10 s.
- **School-wide signups.** One network may start 600 signups in 15 minutes (was 150), so a whole school can register together on its Wi-Fi. Each signup still needs its own e-mail code.

## Results (4-core test machine, `NODE_OPTIONS=--max-old-space-size=300`)

- 500 students doing everything at the same instant (sign in, dashboard, start, 3,000 answers, submit, result, PDF result card, leaderboard): 500 of 500 succeeded with distinct addresses and with one shared school address. Sign-in median about 5.5 s when all 500 sign in in the same second; other steps 0.1 to 4 s, PDF result cards up to 8 s (built six at a time). The health check stayed near 30 ms (95th percentile about 110 ms).
- 500 already signed-in students starting a scheduled test together: start 3.1 s median, answers and submit under 2 s, no errors. Memory peaked at about 400 MB.
- 450 students of one school signing up together from one Wi-Fi: all received the code, verified and were signed in.
- Slow 3G, an 800 ms round trip (far from the server) and fast 4G: every tapped answer saved; a full 6-question test completes in about 8 s on slow 3G. Connection dropping mid-test, submitting while offline and reloading with unsent answers: no answer lost.

## Set these on the host (in addition to the list above)

- With 400 to 500 students at once, a 512 MB plan is close to its limit (about 400 MB peak). Use 1 GB if the plan allows it.
- E-mail: 450 signups send 450 codes within minutes. Check the SMTP plan's hourly and daily limits before asking a whole school to register at once.

# Blocking and deleting student accounts

Super admins manage this on Admin, Students.

- **Block** signs the student out on every device at once. A blocked student cannot sign in (password or Google), reset the password, keep using an open session (including a test in progress) or sign up again with the same email or phone number, however the number is typed. Each of these shows an animated "You are blocked from using IlmiDunya. Contact support to unblock your account." message. It is shown at sign-in only after the right password, so it reveals nothing to someone guessing passwords. Blocked students are not on the leaderboard. Results are kept.
- **Unblock** restores the account. The student signs in again with the same password.
- **Delete** removes the account with its test attempts and activity. After a plain delete the same email and number can sign up again. If the student was blocked (or the admin chooses "Block and delete"), the email and number stay blocked and are listed under "Blocked emails and numbers", where "Allow sign-up again" lifts the block.
- Optional settings: `SUPPORT_EMAIL` and `SUPPORT_WHATSAPP` add contact buttons to the blocked message.
- A blocked email now gets the blocked message on the password reset page instead of the neutral reply, because the sign-up page already tells that person they are blocked.
- Run `npm --prefix server run indexes` once after deploying, so the blocked list gets its unique index (production does not build indexes automatically).

# Verification code e-mails

Three common settings made every code fail, and are now handled:

- `SMTP_PORT=465` without `SMTP_SECURE=true` (Hostinger uses 465 with SSL): the connection hung and failed after 8 s. Port 465 now uses SSL unless `SMTP_SECURE` says otherwise.
- No `MAIL_FROM`: mail was sent "from" `no-reply@ilmidunya.pk`, which a mailbox on another address is not allowed to send as (rejected with "sender address not owned"). The sender now defaults to the SMTP mailbox itself.
- A password pasted with quotes around it was sent with the quotes. Surrounding quotes and spaces are now removed.

Also: codes are sent with a plain-text version (HTML-only mail is more often filed as spam), replies go to the mailbox or `SUPPORT_EMAIL`, the server log says why a send failed in plain words, and every start logs the e-mail setup and whether the SMTP login works. Super admins have Admin, Students, Email delivery to check the setup and send a test e-mail. The sign-up and password reset code screens point students to their Spam/Promotions folders and offer "Send a new code" after the one-minute wait.

Still outside the code: the domain's SPF, DKIM and DMARC records must allow the mail service (Hostinger adds them for its own mailboxes; Resend needs its records added and the domain verified), otherwise Gmail may place codes in Spam.

## Student ranking (IlmiDunya Score)

The leaderboard ranks students by how well they know the syllabus, not by how many tests they repeat.
The rules live in `server/src/services/ranking.js` (`RULES`) and are covered by `server/tests/ranking.test.js`.

- Attempt score (0-100): 90% accuracy, plus up to 10 for finishing early when at least 60% is correct. Under 3 seconds per question counts as guessing and scores 0.
- Test score: 60% first ranked attempt + 40% best ranked attempt. Retakes are ranked only 12 hours after the previous ranked attempt, at most 3 per test.
- Longer tests weigh more (full weight at 20 questions). A shorter set chosen from a chapter or topic counts from 10 questions. Per chapter, the chapter test or the topic tests count, whichever is higher.
- Skill: weighted average; with few tests a high average is pulled toward 50% (as if 2 more full tests at 50%). Activity factor 0.6-1.0 (full at 30 tests).
- Score = 10 x Skill x Activity (out of 1000). One counted test is enough to appear. Ties: accuracy, then seconds per question, then who got there first.
- A test left without submitting is marked with its saved answers 5 minutes after its time runs out (`server/src/services/expiredAttempts.js`), so walking out of a hard test cannot hide it. This applies to tests started after the code first runs (`LeaderboardState.expiredAttemptsFrom`).
- Periods: this week, this month, all time (Pakistan time, week starts Monday). Students see their own position via `GET /api/leaderboard/me`.

After deploying, run `npm --prefix server run indexes` once to build the new `{ status, submittedAt }` attempt index.

## School result PDFs and verification

Admin → School Results downloads three files for a school, class or section, optionally narrowed to one subject and a date range:

- **Result report (PDF)**: key results, grade distribution, subject/chapter/topic performance, topics that need attention, merit list, students yet to attempt, grading scale, signature lines, IlmiDunya stamp and a verification QR code.
- **Student report cards (PDF)**: one card per student who took tests, with every attempt (topic, try number, date and time, right/wrong/skipped, marks, score, time, grade, result), subject summary, position and remarks. Each card has its own reference and page numbering.
- **Excel workbook**: unchanged, now also honours the subject filter.

PDFs are built on a worker thread (`services/schoolReportPdf.js`, data from `services/schoolReportData.js`), limited to 800 students and 6,000 attempts per file. Every PDF is recorded in `IssuedReport`; anyone can check a reference at `/verify/<reference>` (API `GET /api/verify/:reference`, rate limited, no contact details shown). Set `SITE_URL=https://www.ilmidunya.org` so QR codes point to the live site, and run `npm --prefix server run indexes` after deploying for the new `IssuedReport` indexes.

## Test time per question or total

Admin → Publish Tests has a timer button on every topic and chapter (before or after publishing). A test gets either seconds per MCQ (10–600) or a total time (1–1440 minutes); a total time is shared out when a student picks fewer MCQs. A chapter's time sets its complete chapter test, and a per-question time can also be applied to every topic test of the chapter. The MCQ Tests builder offers the same choice. Tests never changed keep their old behaviour (chapter and topic tests one minute per MCQ). Attempts already running keep the time they started with. Rules: `server/src/services/testTiming.js`.
