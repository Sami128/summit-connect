# Summit Connect

**Retail Communication & Acknowledgment Platform**

Summit Connect connects managers and associates through targeted announcements, read receipts, critical-update acknowledgments, response reports, and announcement-grounded AI assistance. It was built using Codex in VS Code for the MangoApps Associate Product Manager, AI Builder take-home assignment.

[Live demo](https://summit-retail-connect.sami-ahmady-4595.chatgpt.site/) · [Portfolio](https://sami128.github.io/#summit-connect)

The demo represents a fictional retail organization with five stores and 200 synthetic manager and associate profiles. Role/name selection is a demonstration convenience, not verification of a real employee's identity.

## What's included

| Folder | Edition | Main technology |
| --- | --- | --- |
| [summit-retail](summit-retail/) | Original application; easiest local starting point | Next.js, React, TypeScript, Tailwind CSS; local storage or optional Supabase |
| [summit-retail-site](summit-retail-site/) | Source of the hosted edition | Vinext, React, Cloudflare Workers, D1 |

Both editions include the application UI, server/API routes, AI integration, synthetic seed data, database schemas, tests, configuration templates, and their own setup documentation. Existing third-party license notices are preserved.

## Run the original app locally

Use Node.js 22 or newer (the original project's `.nvmrc` selects Node.js 24).

```sh
git clone https://github.com/Sami128/summit-connect.git
cd summit-connect/summit-retail
npm ci
npm run dev
```

Open `http://localhost:3000`. No API key, email, or password is required for local demonstration. The app creates its synthetic data locally on first use.

To enable generated AI answers, copy `.env.example` to `.env.local` and configure **your own** provider key. OpenAI uses the Responses API with retrieval-augmented generation (RAG), bounded conversation history, and structured output. Without a configured provider, the app returns labeled source-based answers.

For the Cloudflare/D1 edition, follow [its local Worker setup](summit-retail-site/README.md#run-a-local-worker-preview). Its hosting configuration preserves the `DB` binding but omits the original deployment's project ID. Publishing through Sites requires a project belonging to your own account; standalone local preview does not require that project ID.

## Credentials and local files

This repository intentionally excludes actual API keys, `.env.local`, `.dev.vars`, session-signing secrets, local runtime databases, Git history from the working deployment, installed dependencies, build artifacts, and development screenshots. Only blank environment templates are included. API integration source remains so reviewers can inspect and run the application with their own configuration.

## Validation

Before publication, the original application passed 121 automated tests and TypeScript checks. The hosted edition passed 15 automated tests and TypeScript checks. See each edition's README for build and workflow checks.

The prototype's read receipts show that an update was opened; acknowledgment is an explicit action rather than proof of comprehension. Native push notifications, email delivery, offline synchronization, and HR system integration are outside the current implementation.
