# Data, roles, and persistence

The prototype has two storage modes behind the same Next.js API. `DATA_DRIVER=local` uses `.data/summit.json` (or `LOCAL_DATA_DIR/summit.json`), a file outside the client bundle. Mutations are serialized within a single Node process and replace the file atomically. Reads load persisted state, so independent browser sessions see updates on their next refresh/poll. Local mode is intended for one development server; it is not a distributed storage system. The app rejects local mode on Vercel.

`DATA_DRIVER=supabase` uses the relational tables in `supabase/schema.sql`. Announcements and their audience rows are created in one database transaction. Receipt updates use a database function with a row lock and idempotent timestamps. Table reads are paginated, including audiences larger than Supabase's default 1,000-row response limit. Database errors are reported and never cause a silent fallback to local data.

## Initialize a separate synthetic Supabase project

1. Apply `supabase/schema.sql` in the project's SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; set `DATA_DRIVER=supabase`.
3. Run `npx tsx supabase/seed.ts` from the project directory.

The seed refuses to run if employees already exist, preserving an existing dataset. It inserts 200 fictional employees, five stores, six announcements, and example receipts. The service-role key is used only by the Next.js server and the seed script. No Supabase key uses a `NEXT_PUBLIC_` variable. Row-level security is enabled; public and authenticated browser roles have no direct table or RPC access.

## Demo identities

Local file storage defaults to credential-free role/name entry in both development and the production build (`npm run start`), even without an environment file. Adding an employee needs no email/password or external API keys after a manager selects their name. Explicit `DEMO_MODE=false` is always respected. Shared Supabase production storage defaults to verified sign-in; synthetic hosted entry requires deliberate `DEMO_MODE=true`. Use a dedicated synthetic database for any hosted demo. Set the same long `DEMO_SESSION_SECRET` across all server instances so demo identity cookies remain valid across requests and deployments. Vercel requires this explicit variable. Locally, an omitted secret is generated once and saved in the ignored data directory as `.demo-secret` with owner-only file permissions, preserving demo cookies across server restarts.

The 200-record roster includes the user-requested **Sami Ahmady**, **General Manager** (`EMP-0004`), with manager access in Operations. Michael, Rachel, Alex, all five store managers, and all employee IDs remain stable. Names carry no demographic labels and do not determine permissions; access comes from the explicit role on each record.

There is no automatic default identity. A new demo session must choose a role and name before opening a workspace. Michael (`EMP-0001`), Rachel (`EMP-0002`), and the other fictional managers enter under their selected names; Alex (`EMP-0003`) and other employees enter their own employee experience. Demo selection uses a signed, HttpOnly, SameSite cookie. Valid selections persist across reloads and server restarts. Deleting demo cookies returns the browser to the name-selection screen.

`GET /api/session?portal=manager` and `GET /api/session?portal=employee` provide separate minimal fictional name lists for the entry screens, with `Cache-Control: no-store`. A fresh session defaults to the manager list. An active associate session always receives associate choices, even if the request asks for a manager list, and cannot switch to a manager through `POST /api/session`. Associate bootstrap data contains no identity-switching roster. Managers can still preview an associate from their employee directory. These synthetic demo affordances are not production authentication: secure sign-in mode returns empty identity/store lists and relies on Supabase credentials and trusted roles.

`POST /api/session` explicitly selects the permitted synthetic employee ID, and subsequent manager announcements derive their author from that selected server-verified session. Missing, invalid, or expired demo cookies return to fresh name selection; signed-in associates must sign out before starting a separate manager demonstration.

## Secure sign-in

With `DEMO_MODE=false`, create users through Supabase Auth and provision their trusted employee mappings in the SQL editor:

```sql
insert into public.employee_auth(user_id, employee_id)
values ('<Supabase Auth user UUID>', 'EMP-0003');
```

The user then signs in with email and password through `POST /api/session`. The server stores access and refresh tokens in HttpOnly, SameSite cookies and refreshes expired tokens server-side. Cookies use Secure when requests arrive through HTTPS. A valid Supabase bearer token is also accepted by the APIs. Roles come from `employees.access_role` through the trusted mapping, never from client requests or editable Auth user metadata. Sign-out clears the browser's application cookies.

Managers can communicate across all five stores in this prototype, including store managers such as Rachel. A future store-scoped permission model would need to restrict every manager query and mutation on the server. Associates receive only announcements that target their ID, their own receipts, and the small directory needed to identify themselves, their manager, and message authors. Other recipients are removed from employee announcement payloads.

Only critical-priority announcements may request acknowledgment. Opening an announcement records a read receipt; acknowledging requires a saved read receipt and a targeted audience membership. Retrying preserves the original timestamps. Routine updates have no acknowledgment action. Late responses remain possible after a deadline.

Manual entry always creates an employee role and generates a unique ID. Names need not be unique because two people may share a name. New employees are not retroactively added to previously sent announcements: audiences are snapshots at send time. HR synchronization, native mobile push, per-store authorization, managed identity lifecycle, audit-log retention, and a distributed abuse limiter are future production work. The current per-instance sign-in and AI rate limits are prototype safeguards.

## Verification

`npm test` includes domain and adapter tests for audience validation, permissions, read-before-acknowledge, timestamp idempotency, concurrent writes, persistence reopened in a fresh Node process, and paginated Supabase retrieval. The Supabase adapter tests mock HTTP responses; they do not execute PostgreSQL or verify a live project.

With a running demo server, `npx tsx tests/workflow.integration.ts` exercises independent HTTP cookie sessions against the real Next.js routes. `BASE_URL` defaults to `http://localhost:3000`. The test creates announcements and two same-name employees labeled with a QA timestamp; it does not delete or overwrite seed records. Run it against a disposable local data directory if you want to preserve a clean demonstration dataset.

Managers can read every announcement regardless of rank or audience membership. An untargeted manager may save a read receipt without being added to the delivery audience. Acknowledgment is permitted only for selected recipients: associates confirm normal critical requests; managers confirm only a General Manager’s critical request. Authors never acknowledge their own announcement. The shared eligibility helper, local store, Supabase receipt RPC, UI, and analytics follow this rule. Historical receipt rows remain intact. Observer reads outside the delivery audience do not count toward audience read rates.

Apply the latest schema before using an existing Supabase database: it replaces the receipt-to-delivery composite foreign key with separate announcement/employee foreign keys and updates the service-only receipt RPC. The RPC continues to enforce associate targeting and manager confirmation eligibility. The local/API tests do not substitute for testing that migration against a configured synthetic Supabase project.
