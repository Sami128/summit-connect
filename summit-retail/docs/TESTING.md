# Testing Summit Connect

Use synthetic data and one server process per local data directory. Keep record-creating QA separate from the clean review dataset:

```sh
LOCAL_DATA_DIR=/private/tmp/summit-connect-qa DATA_DRIVER=local DEMO_MODE=true npm run dev
```

A new path creates a fresh dataset; reusing a path preserves prior changes. Multiple independent browsers can connect to the same process. Do not run two local server processes against one data directory.

## Automated checks

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Run the current suite and use its reported test count; the policy tests are extended as the policy behavior changes. The suite covers:

| Area | Meaningful checks |
| --- | --- |
| Synthetic records | 200 distinct names/IDs, 40 employees per store, seven managers including Sami Ahmady, valid reporting references. |
| Validation | Empty/unknown audiences, dates, oversized messages, routine acknowledgment rejection, manual role-escalation rejection. |
| Receipts | Recipient access, reading before confirmation, idempotent timestamps, read/confirmation visibility. |
| Entry and roles | Explicit role/name selection, selected manager authorship, role-filtered directories, rejection of an active associate switching to a manager. |
| Read-only preview | Manager-only access, correct selected associate, no receipt/cookie mutation, no access for associates or invalid targets. |
| Persistence | Concurrent changes retained, records and local signing identity available after a fresh process, atomic signing-secret initialization. |
| Supabase/Auth adapters | Pagination beyond default limits, visible incomplete configuration, shared token refresh and returned secure cookies. |
| Policy/Gemini | Company-rule retrieval, pay/approval safeguards, violations/coaching/warnings, legal references when relevant, unsupported requests, input validation, mocked success and provider failures. |

Supabase adapter tests mock HTTP and do not execute live PostgreSQL functions, RLS, or Auth. Gemini tests mock the provider rather than verify an actual key/model. Complete the credentialed integration checks below before publishing a service-backed deployment.

## Real Next.js HTTP workflow

With a running disposable synthetic server:

```sh
npx tsx tests/workflow.integration.ts
```

For another port:

```sh
BASE_URL=http://localhost:3001 npx tsx tests/workflow.integration.ts
```

This script selects explicit identities and checks targeted critical/routine messages, unauthorized recipients, employee boundaries, reading before confirmation, timestamps, retries, second-client synchronization, validation, concurrent sends, and distinct IDs for same-name employees. It adds QA-labeled announcements and employees and leaves original seed records intact. Run it only against a disposable synthetic dataset.

## Browser entry and account journey

1. With no active session, open `/`, `/manager`, or `/employee`. Verify the first step offers **Manager** and **Associate**. No person is selected automatically.
2. Choose Manager, then type `Sami Ahmady` or `EMP-0004`. Verify the correct person is resolved and Continue opens Sami’s General Manager workspace. Try selecting Michael or Rachel from the list instead; the selected name must match the greeting, account, and author of new announcements.
3. Go back from the name step and choose Associate. Only associate names should appear. Enter Alex by clicking his row and by typing his exact full name or ID. Partial text should show candidates; an unknown name must not enter or create a person.
4. Verify accent-insensitive typing: `Elodie Laurent` resolves `Élodie Laurent`; test another accented name. If two people share a name, require an explicit selection or unique ID rather than choosing silently.
5. On mobile and desktop, use the account menu to sign out. The role-first entry returns. Once signed in as an associate, there must be no manager role switch or manager identity choices in the workspace. Attempted associate-to-manager API switching should return 403.
6. Check keyboard navigation, focus after steps change, Enter submission, loading states, retry errors, and a change of role while directory loading is in progress. Previous selections must not carry into a new role.

## Manager and associate communication journey

Use a manager session and an independent incognito/browser-profile associate session. Tabs in one profile share cookies.

1. In Employees, search by name/ID, combine store/department/role filters, and select an individual or the filtered group. Clear filters and ensure the selection count remains clear. Verify a useful empty-search state and that mobile directory cards show their controls without a wide horizontal table.
2. Open Alex’s **View updates** preview from the directory. Open critical and routine messages and verify no read/confirmation timestamps change. Confirmation controls must be absent or read-only. Return to Employees and verify the manager’s identity, search, filters, and selected people remain intact.
3. Use the manager’s **My updates** to read every announcement. Verify that only a selected General Manager request shows a confirmation action, and that an author cannot confirm their own update. Manager previews must never confirm an associate’s response.
4. Send a routine message only to Alex. Verify Alex receives it, an untargeted associate does not, and no confirmation is requested. Opening it should save Alex’s read time.
5. Send a critical acknowledgment request with a future deadline. Verify Alex initially appears pending. In Alex’s own session, open it, optionally ask a policy question, then choose **Confirm I’ve read this**. Verify saved status appears promptly and the manager sees Alex’s name and both timestamps within a polling interval or on focus.
6. Refresh or reopen an independent Alex session, then restart the server with the same data directory. Confirm stored messages and responses persist. Repeating an acknowledgment must preserve its first timestamp.
7. Add an associate with valid store/manager details. Check generated ID, search visibility, validation errors, and automatic store-manager assignment. No email, password, or external API key should be needed locally. Previously sent audiences must remain unchanged.
8. Disconnect the network while attempting a read or confirmation. Show an actionable retry state; never falsely show success. Reconnect and retry. A successful saved receipt should not disappear while a subsequent feed refresh is slow.

The local browser walkthrough has exercised the complete **Sami → targeted critical announcement to Alex → Alex’s role/name entry → read → optional policy question → confirmation → Sami’s named response tracking** journey. Manager previews and directory return behavior were also checked. Record-creating QA must be removed or kept in its separate data directory before handoff; a clean seed contains 200 employees, six announcements, and 879 historical receipt records.

## Policy assistance

- Ask “Can I work more than 60 hours?” and “Do extra hours need approval?” Expect company scheduling guidance and the required approval process.
- Ask “What happens if I exceed the limit?” Expect the company policy’s coaching and written-warning consequence, while preserving payment for worked hours and eligible overtime.
- Ask about pay for unapproved hours and confirm that missing approval does not remove wages or overtime eligibility. The company planning limit must not delay overtime until 60 hours.
- The default experience should focus on company policy, with optional **Sources** / supporting references. Explicit legal questions should remain grounded in official source passages, with official links available in the disclosure and a source-review note.
- Try an unrelated question such as weather. Expect an honest unsupported answer, not invented policy.
- With no Gemini key, expect a transparent source-based notice. With provider/network failure, expect a labeled fallback or retryable error. Asking the assistant must not itself confirm an announcement.

## Mobile, browser, and themes

Check light and dark themes at desktop, tablet, 390px and 320px widths. Verify the chosen theme survives reloads, entry/role changes, and sign-out. The associate’s first important update should be accessible without excessive introductory space. Long name lists must scroll normally without blank space from hidden controls. Check touch targets, source disclosures, dialog scrolling, visible focus, Escape dismissal, return focus, and usable errors.

Viewport checks establish responsive layout; they do not replace physical-phone testing. On a phone on the same LAN, reach the same server’s network address and verify manager updates reach the phone and confirmations return to the manager. The manifest supports a standalone web presentation where available; no native push or offline behavior is claimed.

## Credentialless startup

In an isolated copy or test environment with no `.env.local`, Supabase variables, or Gemini key:

1. Run `npm ci` and `npm run dev`; complete role/name entry and add a valid associate.
2. Run `npm run build`, then `npm run start`; repeat entry and verify local persisted data.
3. Confirm no email/password, cloud account, or API key is requested in this local configuration. Partial Supabase-mode settings must fail visibly instead of silently switching storage.

Do not remove a user’s configured environment file to perform this check; use an isolated environment or temporarily preserve and restore it.

## Live-service checks before publication

For Supabase, use a dedicated synthetic project and follow the README schema/seed instructions. Repeat the HTTP workflow with intentional synthetic access, then set `DEMO_MODE=false` and provision verified manager/associate Auth mappings. Check sign-in/out, unmapped-user rejection, token refresh, wrong-role denial, recipient boundaries, read-only preview, SQL transactionality, concurrent retries, direct anonymous table/RPC denial, and shared state across deployed instances. A database outage must never silently become a local-storage success.

For Gemini, configure the server key/model and verify a real successful answer, unavailable model, invalid key, rate limit, timeout, and fallback behavior. Unsupported questions should not consume a model request. Never include personal information or real employee data in test questions.

No live Supabase account or Gemini key has been supplied. Mocked success is not proof of a configured live service. Run the final suite, TypeScript check, production build, browser/mobile walkthrough, and applicable live-service checks before promotion. Nothing has been published.

## Final verification record

The final TypeScript check and all 67 automated tests passed. Coverage includes password-free local production entry and associate creation with external credentials absent, role-specific name lists, manager-only previews that preserve session and receipt history, Unicode name handling, persistence/concurrent writes, policy coaching/write-up guidance, source retrieval, and AI-provider failure paths.

The hidden-radio overflow regression was reproduced and fixed by containing name controls within the scrolling fieldset. Browser measurements at 390×844 gave document height 844px and list height 220px with all 193 associate names loaded, with no empty page overflow. Narrow layouts were also checked at 320×740. Directory selections and search remain set when returning from an employee preview.

Sami Ahmady, General Manager, sent one QA update to Alex Morgan. Alex entered by role/name, opened it, asked the optional policy assistant, and confirmed it on mobile. Sami saw Alex’s read and confirmation timestamps. The QA update and linked receipt were removed after verification, preserving the clean 200-person roster and six original announcements.

## Topic and audience verification

Topic creation, duplicate validation, role authorization, legacy persistence migration, and contextual topic assistance are covered by automated tests. Audience tests cover region/store/department AND matching, mixed manual selections, invalid/duplicate IDs, search, and scoped directory filtering.

In the browser, Sami added a Seasonal product launch topic, reviewed its own source-grounded summary, and created an announcement from it. Selecting Seattle & Eastside selected 120 employees; Downtown Seattle plus Sales narrowed the audience to eight. Manual selection added Sami from Operations without dropping the Sales group. The nine-person update reached Alex, displayed the correct topic, required no confirmation at Important priority, and answered product-launch questions without scheduling rules.

The final interface removes decorative communication/team copy, uses a compact role-first entry, and retains functional counts, fields, errors, and status feedback.

## Unread attention styling

Unread updates use a static green sheen, slim leading edge, and visible Unread marker in both themes. Personal unread counts include routine updates; pending confirmation remains a separate status. The bell opens the signed-in person’s updates, while the manager’s Announcements navigation retains the team response count.

Browser verification confirmed that opening Alex’s unread routine update saved its read receipt, removed the highlight, reduced the personal count from four to three, and retained the read state after reload. Both light and dark surfaces were checked, with no horizontal overflow at 390px. Failed read requests must retain the unread cue; manager previews must leave receipts unchanged.

Associate-facing and shared page copy uses personal updates or store context. The browser title is “Summit Connect | Your updates,” the shared sign-in welcomes the user, and the announcement dialog is labeled “Announcement.” Manager-only team instructions remain scoped to managers.

## Applied deadline and functional regression checks

The composer uses a selected date/time and an applied deadline. Apply validates and commits the selected local value; the applied summary includes the timezone. A later edit must be applied again. Send validates missing topic, trimmed title/message, recipient selection, and deadline state with visible feedback. It is disabled during an active request, with a synchronous guard against repeated clicks. Critical priority and acknowledgment changes clear obsolete deadline errors.

The browser walkthrough verified a past-date rejection, applying Nov 5 at 5:30 PM, editing to Nov 6 at 6:15 PM, rejecting Send until reapplying, and preserving the applied deadline through Back/Continue. Sending then persisted `2026-11-07T02:15:00.000Z`, matching Nov 6 at 6:15 PM PST, to Alex only. The mobile composer fit within a 390px viewport.

Additional UI checks passed for directory pagination, region/store/department filtering, eight Sales employees plus Sami manually selected, read-only Alex preview, preserved filters/selections on return, manual employee creation with Rachel assigned automatically, topic empty search, and duplicate-topic validation. These QA writes used an isolated directory under `/private/tmp`; review data was untouched.

The isolated production HTTP workflow verifies topics and recipient privacy; critical and routine sends; exact future deadline round-trip; invalid/past date rejection; read and confirmation timestamps; acknowledgment retries; independent-client synchronization; concurrent persistence; and manual employees with distinct IDs for the same name. All 67 automated tests and TypeScript checks passed.

Development now uses Webpack explicitly, matching the production build, after repeated Turbopack development reloads interrupted browser verification in this environment. The entry instruction is “Select your role to continue.”

The production-build browser walkthrough completed Alex’s read → optional source-based topic answer → confirmation → reload journey. Sami then saw Alex’s name and both timestamps with zero pending confirmations for the test update. Response filtering and Analytics opened correctly. Switching an unapplied critical draft to Routine cleared its obsolete deadline warning, hid date controls, sent successfully, and stored no deadline or acknowledgment requirement.

The browser’s downloads-page URL is restricted, so download-directory inspection was not used. CSV generation is verified separately with report-format and escaping tests; the export control was exercised in the UI.

CSV formatting now has four dedicated tests for recipient fields, saved timestamps, quoting/Unicode, formula escaping, and empty filtered reports. The export control uses an attached download link and delayed Blob cleanup. Final verification includes 67 passing tests, TypeScript, and the production build.

## Custom topics, date/time panel, and manager visibility

Managers can choose **Add new topic** beside the composer’s topic selector or **+ Add new topic…** inside it. Creating a topic validates its name/details, saves and selects it, and preserves recipients, title, and message. Cancel restores the previously selected topic.

The app-controlled date/time panel contains its calendar, hour/minute/AM–PM fields, Cancel, and Apply. Apply validates and commits the chosen local deadline, closes the panel, and displays the applied value with timezone. Cancel discards the panel’s changes. Escape closes the panel without closing the announcement draft. Pending changes must be applied before sending. The panel was checked in light/dark themes at 390px and 320px; its time controls and Apply remain visible on the narrow layout.

Managers can read every announcement, regardless of rank or audience selection. Confirmation is required from an associate when selected for a critical request. A manager confirms only when explicitly selected for a critical request authored by a General Manager. Authors never confirm their own announcements. Visibility does not add a manager to the delivery/confirmation audience. Historical manager receipts remain saved, but current pending/confirmed counts use effective eligibility. Reads outside the selected audience do not affect read-rate analytics.

The browser walkthrough created a custom Holiday service standards topic from a draft targeted to Alex, Rachel, and Sami. It retained the draft, applied Nov 6 at 6:15 PM PST, and sent successfully. Tracking showed two required confirmations, with Sami labeled No confirmation needed. Sami read his own update without confirming; unselected Michael could read it without confirming; selected Rachel received the request and confirmed it.

The HTTP workflow independently passed topic creation/duplicate validation, exact deadline persistence, selected General Manager-to-manager confirmation, self-confirmation rejection, non-targeted manager reads, associate audience boundaries, ordinary-manager confirmation exemption, retry timestamps, synchronization, and concurrent persistence. All QA records remain in an isolated `/private/tmp` dataset.

The local/API suites, calendar and role-aware statistics regressions total 82 passing tests. Live Supabase SQL/RPC behavior still requires verification in a configured synthetic database after applying the schema upgrade; local tests and mocked adapters do not replace that check.

The final production build passed after these changes. Review data was preserved; custom-topic and manager-confirmation QA used an isolated data directory.

## OpenAI provider support

The server supports OpenAI Responses alongside Gemini. `AI_PROVIDER=auto` chooses OpenAI when `OPENAI_API_KEY` or the compatible local alias `OpenAI_API` is set. `AI_PROVIDER=openai` or `gemini` selects explicitly. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. No secret belongs in a `NEXT_PUBLIC_` variable.

Mocked tests verify provider/key precedence, key headers rather than URL parameters, structured response parsing, refusal/incomplete/malformed output, HTTP/network/timeout fallback, scoped policy/topic requests, and credential-free app responses. OpenAI requests use `store: false`, a fixed HTTPS endpoint, no redirects, and only the question plus retrieved fictional/public passages. Existing Gemini tests remain in place.

A live OpenAI verification with the configured local key returned HTTP 200 for both scheduling-policy and general-topic questions. Both responses passed the existing grounding checks and returned `mode: openai`. Only fictional policy/topic passages were sent. The key value was neither printed nor included in assistant responses. This does not verify Gemini or Supabase configuration.

## Conversation-aware RAG verification

The assistant accepts up to six completed user/assistant exchanges, with per-message and 20 KB UTF-8 history bounds. Privileged roles, incomplete pairs, oversized content, and malformed histories are rejected. Topic authorization happens before history validation. OpenAI receives user/assistant history roles and Gemini receives user/model roles; both still receive only the current authorized passages as factual authority. Request size is capped at 32 KB.

Regression tests cover “Who approves that?”, summary-to-follow-up transitions, narrow approval answers, unrelated new questions, forged historical claims and citations, shared acknowledgment guidance, and unauthorized topics. History is kept when assistance is hidden, cleared on topic/details change or New conversation, and is not written to the database. The source and retrieval suites now total 109 passing tests, with TypeScript passing.

Four illustrative playbooks replace only exact untouched placeholder strings. Tests verify useful retrieval, no scheduling-topic crossover, preservation of all custom edits/names/authors and receipt history, and persisted local upgrades. The Supabase schema contains the same exact-match upgrade; live SQL still needs a configured synthetic project.

Announcement chat now sends only an announcement ID; the server resolves authorized title/body text and enforces its topic match. Distinct announcement passages can answer specific update questions without importing unrelated scheduling rules. Tests cover hidden IDs, mismatch, malformed IDs, spoofed client text, announcement-specific follow-ups, relevant summary/actions, and fabricated approval rules. All 117 tests and TypeScript checks pass.

A live browser conversation followed “Can I work more than 60 hours?” with “Who approves that?” and received the Operations Manager answer. Hiding/reopening retained the transcript; New conversation cleared it and cancelled pending UI work. A concise-answer guard was refined so valid specific replies no longer require unrelated overview facts.

The running app and saved records were checked for Sami’s own announcements: both were exempt from self-confirmation and Sami had zero pending confirmations. The author’s UI now explicitly says Your announcement, View sent update, and You sent this update · no confirmation needed. No announcement data or receipt history was reset.

Manager tracking uses Confirmation requested, Awaiting responses, and explicit recipient pending counts so an announcement’s recipient requirements cannot be confused with the sender’s own obligations. Personal confirmation prompts remain scoped to eligible recipients.

Final verification passed all 117 tests, TypeScript, and the production build. Four live OpenAI replies through the running app verified a scheduling question and its approval follow-up, then a saved announcement’s weekly limit and its manager-coordination follow-up. All four returned `mode: openai` with grounded sources. The announcement answers used its stored body despite its broader topic label. Current retrieved passages are the sole factual authority; fixed business rules are not duplicated in the model instructions. A scan of 32 browser artifacts found no configured API key values.

## Hosted Sites edition

The separate `summit-retail-site` checkout preserves the Next.js project and publishes the same interface through Vinext/Cloudflare Workers with durable D1 state. Six additional D1/SQLite tests cover competing initialization, independent concurrent clients, rollback, failure behavior, retry bounds, and persisted normalization. The built-Worker HTTP workflow passed topics, targeted sends, read/confirmation timestamps, selected-manager and author rules, deadlines, cross-client synchronization, concurrent writes, and manual employees. QA records remain in ignored local Wrangler state; the initial hosted snapshot remains 200 employees, six topics, and eight announcements. Hosted TypeScript and the Worker build pass; a scan of 82 deployment artifacts found no configured API key values or local environment files.

The public edition was published on October 31, 2026 at https://summit-retail-connect.sami-ahmady-4595.chatgpt.site. The published archive contained the D1 migration and excluded local environment files, runtime databases, and Git directories.

Anonymous entry verification used no ChatGPT sign-in or service token. Both manager and associate role/name sessions worked; D1 retained 200 employees, eight announcements, and six topics across deployments; author self-confirmation was rejected; associate audiences remained scoped. A real two-turn policy/approval conversation returned `mode: openai` for both answers. Eight hosted tests, including redirect rejection without credential forwarding, and the hosted TypeScript/build checks passed. The temporary Wrangler preview was stopped.
