# Summit Connect — hosted edition

The Summit Retail Group manager and associate application, adapted for Sites on Cloudflare Workers with Vinext, React, TypeScript, Tailwind CSS, and shared D1 storage. The original Next.js application remains in `../summit-retail`, including its local-disk and Supabase/Vercel deployment paths. This hosted edition preserves the same role/name entry, topics, employee targeting, announcements, read receipts, confirmations, light/dark themes, and conversation-aware assistance.

**Site address:** [Summit Connect](https://summit-retail-connect.sami-ahmady-4595.chatgpt.site).

## Access and shared data

The Site is public and requires no ChatGPT login, email, password, or application credentials. Choose Manager or Associate, then select or type an existing name. Role/name selection is a synthetic prototype flow, not verification of a real employee identity.

D1 stores the shared application state with a revision check and compare-and-swap updates. Independent Worker instances retry concurrent conflicts instead of overwriting a newer record; exhausted retries return an error. The initial snapshot contains **200 employees, eight announcements, and six topics** and is inserted only when the state is empty. Deployments do not reset existing announcements, employee records, or receipt history.

Managers see every announcement. For critical updates with confirmation enabled, selected associates confirm; selected managers confirm requests from a General Manager. Authors never confirm their own announcements. Read-only associate previews do not create receipts. General topics and announcement chat use their own authorized source details, with bounded conversation history for follow-ups.

Announcement chat uses the open update as its primary source. Requests to simplify, shorten, explain, or summarize it are interpreted conversationally. The configured server-side AI receives authorized announcement passages even when the question does not match topic keywords; source-based RAG remains the fallback.

## Runtime configuration

Configure hosted values with Sites runtime environment settings. Mark API keys and `DEMO_SESSION_SECRET` as secrets; never place their values in source, the hosting manifest, browser variables, or published artifacts.

| Variable | Hosted value |
| --- | --- |
| `DATA_DRIVER` | `d1` |
| `DEMO_MODE` | `true` for the synthetic role/name experience |
| `DEMO_SESSION_SECRET` | A private random value of at least 32 characters, shared across instances |
| `AI_PROVIDER` | `openai`, `gemini`, or `auto` |
| `OPENAI_API_KEY` | Server-only OpenAI key; `OpenAI_API` remains a compatible alias |
| `OPENAI_MODEL` | `gpt-4.1-mini` unless changed |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Optional alternative provider settings |

Outbound provider requests use manual redirect handling and reject non-success responses, preserving the fixed provider endpoint and server-only credential boundary. This follows the [Cloudflare Workers request contract](https://developers.cloudflare.com/workers/runtime-apis/request/), which supports manual redirect handling.

Without a provider key, the assistant returns labeled source-based answers. Provider errors, timeouts, and invalid output also fall back safely. Chat history stays in browser memory, with up to six completed exchanges and a 96 KB serialized limit. Hiding assistance retains it; closing the announcement, changing its topic/details, starting a new conversation, or reloading clears it. Questions and retrieved passages are processed by the configured AI account; the employee directory and application credentials are excluded.

## Run a local Worker preview

Use Node.js **22.13 or newer**. Portable macOS, Windows, and Linux installations are supported.

```sh
npm ci
cp .env.example .dev.vars
```

On Windows, copy the file with the shell's equivalent command. Edit the ignored `.dev.vars`, supplying a random `DEMO_SESSION_SECRET` of at least 32 characters. Leave API keys blank for source-based answers or set the chosen provider key locally. The tracked `.env.example` contains no credentials. Local `.dev.vars`, `.env.local`, generated builds, and Wrangler state are ignored.

Generate a migration after schema changes, then build the Worker:

```sh
npm run db:generate
npm run build
```

The build emits `dist/server/wrangler.json`. Apply each pending SQL migration to the local D1 binding, using the initial generated migration below (use each later generated filename after schema changes):

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_parched_sister_grimm.sql
npm run start -- --port 8787
```

Open `http://127.0.0.1:8787`. The start helper resolves `.dev.vars` from the checkout with an absolute path; it does not copy local credentials into build output. Local migrations and the preview share `.wrangler/state`; do not replay migrations already applied. This command changes only local preview data. It does not publish or migrate the hosted database. `npm run dev` provides the Vinext development server; use the built Worker preview for D1 integration checks.

## Verify and publish

```sh
npm test
npm run typecheck
npm run build
```

The original Next.js application passed 117 tests, TypeScript, a production build, and live OpenAI conversation checks. This edition passes eight hosted tests (six D1 persistence/concurrency cases and two provider transport cases), TypeScript, and its Worker production build. Redirect regressions verify that OpenAI and Gemini requests do not follow a malicious redirect or expose credentials. The isolated built-Worker HTTP workflow passes targeted critical/routine messaging, exact deadlines and invalid-date rejection, read/confirmation timestamps, retry idempotency, selected-manager General Manager confirmations, author exemption, audience boundaries, independent-client synchronization, concurrent persistence, and manual employee creation. A scan of 82 deployment artifacts found no configured API key values or local environment files. QA data stays in ignored local Wrangler state; the published initial snapshot remains 200 employees and eight announcements. Browser profiles share their own session cookies; use separate profiles or devices for simultaneous identities.

When publishing through Sites, use the Sites skill's installation, source synchronization, build, packaging, and saved-version deployment workflow. Its build entrypoint is `node <plugin-root>/scripts/build-site.mjs`; `npm run build` remains available for standalone local builds. Preserve `.openai/hosting.json`, its Site identity, and the declared `DB` binding. Apply production migrations through the publishing workflow. Runtime secret changes require deployment to take effect.

Back up D1 before schema changes or planned data replacement. A source/version rollback does not restore database content. This application does not provide a backup or restore screen, and deployments must not be used to reset data.

In the shared development workspace, see [the original README](../summit-retail/README.md) and [verification details](../summit-retail/docs/TESTING.md). Those sibling paths refer to the original checkout and are not included in this hosted repository. `SOURCE_README.md` preserves its source documentation at the time this edition was prepared.
