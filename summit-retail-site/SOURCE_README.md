# Summit Connect

A manager and associate communication application for fictional **Summit Retail Group**: five Washington stores, 200 synthetic employees, and connected announcement/read/confirmation tracking. Built with Next.js App Router, React, TypeScript, Tailwind CSS, optional shared Supabase storage, and server-side OpenAI or Gemini assistance. The original Summit interface takes visual inspiration from [MangoApps’ public frontline experience](https://www.mangoapps.com/), with independent branding and light/dark themes.

## Start locally

Use Node.js 22 or newer; `.nvmrc` selects Node.js 24.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. **No environment file, email, password, or API key is required for local use.** Adding employees also needs no external credentials. If you want to customize storage or configure external services, copy `.env.example` to `.env.local` and edit the relevant values.

For the built application:

```sh
npm run build
npm run start
```

Local role/name entry works with both development and production builds when external services are not configured. The build uses Next.js’s supported Webpack builder. The lockfile fixes installed dependency versions; environment files, dependencies, build output, and `.data/` are ignored by Git.

The first server read creates `.data/summit.json` with 200 employees, 40 per store, six sample announcements, and receipt history. Existing records are preserved on startup; adding topics and sending announcements does not reset the data. Changes persist across restarts through a serialized mutation queue and atomic file replacement. Local mode supports **one Node server process**; independent browsers and phones can connect to that same process. Use Supabase for multiple server instances or serverless hosting. Local disk mode is rejected on Vercel.

## Enter your workspace

The signed-out flow is **choose a role → select or type your name → continue**. `/`, `/manager`, and `/employee` all use this role-first entry when signed out. A valid existing session resumes its own workspace.

- **Manager:** choose a manager name, including Michael Bennett (`EMP-0001`), Rachel Chen (`EMP-0002`), or Sami Ahmady (`EMP-0004`, General Manager). The selected person’s name appears in the workspace and becomes the author of messages they send.
- **Associate:** select a name such as Alex Morgan (`EMP-0003`). Only associate names appear after choosing Associate, and the signed-in associate workspace contains no manager-selection controls.
- Type a complete existing name or employee ID to continue without clicking a list item. Search ignores case and accents; for example, `Elodie Laurent` matches `Élodie Laurent`. Partial matches show candidates. Unknown names cannot enter; shared names require choosing the correct person or using their ID.

The roster contains seven managers and 193 associates with varied fictional names. Role permissions come from employee records, not from typed text. Local name selection is a prototype convenience, not verification of a real person’s identity. Use Supabase Auth for real authenticated deployment.

## Try the complete communication journey

1. Enter as a manager, open **Employees**, search by name/ID, and filter by region, store, department, or role. Select one person or all matching people, then choose **Message selected**. Manual entry generates a unique employee ID and assigns a manager.
2. Choose a topic, write the announcement, and review the recipients. Add a new topic from the composer when needed without losing the draft. Routine and important updates are informational; only critical updates can request confirmation. For a critical confirmation request, open the date-and-time panel, select a future date and time, then choose **Apply** inside that panel. The applied deadline shows its timezone; apply any later edits before sending.
3. Enter as Alex or another recipient in a separate browser profile, incognito window, or device. Open the targeted update to save its read timestamp. The optional policy assistant can answer questions before confirmation.
4. Choose **Confirm I’ve read this** for a critical update. The UI shows saved status from the server; retries preserve the original timestamps.
5. In the manager session, open the announcement to see named read/confirmed/pending responses and timestamps. Filter pending responses or download the response report. Overview and analytics use persisted activity.

Tabs in one browser profile share a session cookie. Use separate browser profiles or devices for simultaneous manager and associate identities. While visible, the app refreshes every four seconds and when a window regains focus. Devices must reach the same local server or Supabase-backed application. For a phone on the same LAN, use the development computer’s network address and port 3000.

### Review an associate’s experience without leaving the manager workspace

Click an associate’s name or **View updates** in Employees to open a **read-only preview**. The manager session remains active, and returning to Employees preserves search and selected recipients. Previewing an announcement creates no read or confirmation history and cannot confirm on the associate’s behalf. Associate confirmations happen in their own session.

### Who sees and confirms announcements

| Person | Visibility | Confirmation requirement |
| --- | --- | --- |
| Associate | Announcements addressed to them | Selected for a critical update with confirmation enabled |
| Manager | All announcements, regardless of rank or audience | Explicitly selected for a critical confirmation request authored by a General Manager |
| Announcement author | Their sent announcements | Never required to confirm their own announcement |

Managers use **My updates** for their personal read/confirmation status. Their own updates show **View sent update** and **You sent this update · no confirmation needed**. Manager tracking uses **Confirmation requested**, **Awaiting responses**, and recipient pending counts to describe responses from the selected audience. Reading access does not add a manager to that audience. Historical receipts remain saved; effective eligibility determines current confirmation counts, and non-targeted manager reads do not inflate audience read rates.

### Topics and recipient groups

**Topics** includes the **60-hour scheduling policy**, safety, store operations, people, customer experience, and any manager-created topics. Managers add a topic name and details from Topics or **Add new topic** in the announcement composer. Saving selects it immediately and preserves the draft and recipients. Copying topic details into the announcement message is an explicit action. Associates see topics linked to their targeted announcements.

In the audience step, **Select by group** combines region, store, and department with **AND** matching. Changing a group selects its matching employees. **Select people** retains that selection and lets managers add or remove individuals from any department. Search never changes the selected audience. Regions are illustrative operational groups: Seattle & Eastside, North Sound, and South Sound. Audiences are snapshots at send time.

### Mobile, account controls, and appearance

The associate feed places pending updates first and uses compact status cards and large touch targets. Unread announcements have a restrained green highlight and an Unread marker; unread and pending-confirmation counts remain separate. The directory uses mobile cards rather than requiring a wide table. The account menu supports sign-out on mobile and desktop. The sun/moon control follows the device preference initially and remembers an explicit choice in the browser; themes also synchronize across its open tabs.

A web-app manifest supports a standalone mobile web presentation where the browser permits. This is a responsive web application, not a native mobile app. Native push, email delivery, and offline use are outside this implementation.

Announcement chat uses the open update as its primary source. Requests to simplify, shorten, explain, or summarize it are interpreted conversationally. The configured server-side AI receives authorized announcement passages even when the question does not match topic keywords; source-based RAG remains the fallback.

## Environment options

| Variable | Purpose |
| --- | --- |
| `DATA_DRIVER` | `local` or `supabase`; set explicitly for deployment. Incomplete Supabase configuration fails visibly. |
| `DEMO_MODE` | Internal setting for synthetic role/name sessions. Local storage defaults to this mode without credentials, including `npm run start`. Production Supabase defaults to verified sign-in. Explicit `false` is respected; deliberate hosted synthetic access requires `true`. |
| `DEMO_SESSION_SECRET` | Private signing secret shared by hosted synthetic instances. Locally a blank value generates an ignored `.data/.demo-secret` file with 0600 permissions, preserving sessions across restarts. |
| `LOCAL_DATA_DIR` | Local data directory, default `.data`; unused with Supabase. |
| `SUPABASE_URL` | Dedicated Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server-only database/Auth key. Never prefix with `NEXT_PUBLIC_`. |
| `AI_PROVIDER` | `auto`, `openai`, or `gemini`. Auto chooses OpenAI when an OpenAI key is configured; otherwise Gemini. |
| `OPENAI_API_KEY` | Optional server-only OpenAI key. The existing local name `OpenAI_API` is also supported. Never use a `NEXT_PUBLIC_` prefix. |
| `OPENAI_MODEL` | OpenAI model ID; default `gpt-4.1-mini`. |
| `GEMINI_API_KEY` | Optional server-only Gemini key. With no configured provider key, answers are transparently labeled as source-based. |
| `GEMINI_MODEL` | Configurable model ID; default `gemini-3.8-flash`. Confirm availability for the configured account. |

Restart the server after changing environment variables. No service credentials are included in the repository or client application.

## Configure shared Supabase storage and verified sign-in

1. Create a dedicated synthetic Supabase project. Apply [supabase/schema.sql](supabase/schema.sql) in its SQL editor. The schema creates relational tables, RLS, restrictive grants, and transactional announcement/receipt functions.
2. Set `DATA_DRIVER=supabase`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Explicitly enable `DEMO_MODE=true` only while testing fictional name-based sessions.
3. Seed the empty database:

   ```sh
   npx tsx supabase/seed.ts
   ```

   The script loads `.env.local` with Node’s environment-file API and refuses to seed when employees already exist. Seeding spans multiple insertion steps; inspect partial failures in the test project before retrying.
4. For verified access, provision users in Supabase Auth and create trusted mappings in the SQL editor. Replace the placeholder with the account’s Auth UUID:

   ```sql
   insert into public.employee_auth (user_id, employee_id)
   values ('<supabase-auth-user-uuid>', 'EMP-0003');
   ```

   Link manager accounts to the appropriate manager employee IDs, set `DEMO_MODE=false`, restart, and sign in with the provisioned email/password. The server verifies tokens and derives permissions from trusted employee mappings; browser-editable user metadata cannot grant a role.

Database access stays behind Next.js APIs. Browser `anon` and `authenticated` roles have no direct table/RPC privileges. Tokens use HttpOnly, SameSite cookies, Secure over HTTPS, with server-side refresh. Bearer tokens are also accepted. Mutating routes reject cross-site browser requests. See [data and authentication details](docs/data-and-auth.md).

## Company policy and assistance

The fictional company scheduling policy plans no more than **60 working hours in a Monday–Sunday workweek across Summit stores**. Exceptions above 60 need prior written Operations Manager approval. All worked time must be recorded and paid; overtime-eligible employees receive at least **1.5 times their regular rate after 40 hours** in the workweek. Violations of scheduling limits or the approval process result in **coaching and a written warning**; missing approval does not remove earned pay or eligible overtime.

The employee experience presents company policy first. Optional supporting references include [Washington L&I guidance](https://www.lni.wa.gov/workers-rights/wages/overtime/) and [RCW 49.46.130](https://app.leg.wa.gov/RCW/default.aspx?cite=49.46.130). The 60-hour rule is an illustrative company planning limit, not a state overtime threshold. Coverage and exceptions matter; expanded official references should be reviewed for accurate, current guidance.

The server retrieves relevant passages from the authorized topic and current announcement before calling the selected AI provider. The server resolves announcement text from its ID and ignores client-supplied replacements. Sources distinguish announcement text, topic details, and supporting references. A broad topic label does not override an announcement’s actual content.

The seeded knowledge includes practical playbooks for safety and hazard reporting, opening/receiving/closing routines, HR/payroll contacts and recognition, and customer service/product/returns escalation. Shared communication rules are retrieved for relevant read/confirmation questions. General topics do not inherit the scheduling corpus; new topics use their own saved details immediately. Only exact untouched legacy placeholders are upgraded, preserving custom details and receipt history.

Follow-up questions such as **Who approves that?** use up to **six completed exchanges within a 96 KB serialized-history limit**. History helps resolve references and is never a factual policy source. Hiding assistance preserves the conversation while the announcement stays open. Closing the announcement, changing topics/details, starting a new conversation, or reloading clears it. Conversation history stays in browser memory and is not written to application storage.

OpenAI uses the [Responses API with structured JSON output](https://developers.openai.com/api/docs/guides/structured-outputs) and `store: false`; Gemini remains available. Keys stay on the server and are sent in headers to fixed official provider endpoints. AI requests include the question, bounded conversation, and retrieved fictional/public passages, without the employee directory or session credentials. Missing keys, provider failures, timeouts, or invalid output produce a labeled source-based response. Unsupported questions receive a no-match answer. Configured AI calls process submitted questions through the selected OpenAI or Google account. See [policy sources and retrieval design](docs/policy-sources.md).

## Validate and deploy

```sh
npm test
npm run typecheck
npm run build
```

The current release passed **117 automated tests**, TypeScript checks, and a production build. Coverage includes validation, role/audience boundaries, self-confirmation rejection, recipient statistics, persistence, concurrent mutations, date/time application, CSV safety, conversation history, announcement grounding, and AI failure handling. Live OpenAI checks verified policy and announcement follow-ups. Supabase/PostgreSQL and Gemini need separate checks against configured test accounts; mocked adapters do not establish that a live external service is configured.

For a running synthetic test server, `node --import tsx tests/workflow.integration.ts` exercises independent HTTP sessions. It creates QA records; run it against a separate `LOCAL_DATA_DIR`. [Testing instructions](docs/TESTING.md) record normal/edge cases, persistence, cross-session synchronization, read-only previews, and 320px/390px mobile walkthroughs.

For Vercel, select this directory as the project root, use the Next.js preset, `npm run build`, and Node.js 22 or newer. Configure `DATA_DRIVER=supabase`, both Supabase variables, and `DEMO_MODE=false` for verified sign-in. Add the chosen AI provider’s variables if wanted, then apply the schema, seed the synthetic test database, provision Auth mappings, and complete preview testing before promotion. Deliberate hosted synthetic access instead requires `DEMO_MODE=true` and a strong shared `DEMO_SESSION_SECRET`. Server routes are required; do not use a static export.

For an existing database, reapply the updated schema before deploying this release. Its idempotent upgrades add topic links, regions, receipt constraints, role-aware receipt functions, and exact-match topic playbook updates without resetting custom records. Back up the dedicated test database and verify the shared-data workflow before production promotion.

### Hosted Sites edition

**Published on October 31, 2026:** [Open Summit Connect](https://summit-retail-connect.sami-ahmady-4595.chatgpt.site).

The hosted edition lives in the sibling directory `../summit-retail-site` and adapts the application for Sites/Cloudflare Workers with shared D1 storage. The original Next.js application in this directory retains the local and Supabase/Vercel paths above. The D1 edition initializes an empty database with the current 200-person roster and eight-announcement snapshot; existing hosted records are retained on later deployments.

The hosted edition is public: no ChatGPT login, email, password, or separate application credentials are required. Visitors choose their role and select or type an existing employee name. This is intentional open access to a synthetic prototype; role/name entry does not verify a real employee identity. AI and session secrets are configured server-side through hosting environment settings and are excluded from source files. Anonymous live verification passed manager and associate entry, the preserved 200-person/eight-announcement/six-topic dataset, author self-confirmation rejection, scoped associate access, and two contextual OpenAI answers.

## Assumptions and scope

- Employee records, company policies, store addresses, and seeded events are synthetic; Sami Ahmady is the user-provided General Manager label. No real employee or HR dataset is included.
- Managers currently have organization-wide visibility and sending rights across five stores. Store-scoped authorization is a future server-side restriction.
- Associates receive only targeted announcements and their own receipts. Manager previews are read-only. A read means opening an update; a confirmation is an explicit action, not proof of comprehension or a waiver of rights.
- Audiences are snapshots. Newly added people do not retroactively receive old announcements. Responses remain possible after a deadline.
- IDs identify people; names need not be unique. Manual entry cannot grant manager permissions.
- HR synchronization, native push, offline synchronization, managed account lifecycle, long-term audit retention, and distributed abuse limiting remain future integrations. Current sign-in/assistant limits apply per server instance.

