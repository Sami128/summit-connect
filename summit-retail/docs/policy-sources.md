# Policy sources and assumptions

Reviewed October 31, 2026. The corpus in src/lib/policy.ts contains versioned company passages and short, reviewed supporting references. It is not a live legal feed.

## Company policy used by the app

Summit Retail Group and its company policy are fictional. The user-facing assistant explains the company policy directly, without presenting a parallel legal analysis:

- Plan a maximum of 60 working hours per employee in a Monday–Sunday workweek, combining time across all Summit stores.
- Obtain prior written Operations Manager approval before an exception above 60 hours. Staff should ask their store manager before accepting shifts or swaps that would exceed the limit.
- Eligible team members receive overtime after 40 hours worked in a workweek at at least 1.5 times their regular rate. The 60-hour scheduling limit never delays overtime until 60 hours.
- Record every hour actually worked, including unapproved extra hours. A missing approval does not change payment for work already done. Payroll confirms individual eligibility and pay calculations.
- Violating the scheduling limit or advance-approval process results in coaching and a written warning (write-up). Accurate time reporting and questions about pay are expected; they are not scheduling violations. Coaching or a written warning does not reduce payment for work already done.
- Only critical updates require acknowledgment. Confirming records that an update was read; it does not mean agreement, change pay eligibility, or replace training.

These are illustrative product assumptions, not a representation that a real company policy has received a legal compliance review.

## Reviewed supporting references

- [Washington L&I: Overtime & Exemptions](https://www.lni.wa.gov/workers-rights/wages/overtime/) supports the general overtime threshold and rate for covered employees, workweek definitions, and coverage considerations.
- [RCW 49.46.130](https://app.leg.wa.gov/RCW/default.aspx?cite=49.46.130) is the underlying statutory overtime provision and includes exceptions.

The reviewed references remain in internal retrieval to prevent confusing the scheduling limit with the overtime threshold. Standard responses show company passages only. A user who explicitly asks about law or official guidance receives the company-policy answer with fixed official supporting links and a direction to review the source or ask HR for specifics. The assistant does not claim the policy is legally compliant or determine a person’s exemption status. Questions outside this small corpus, such as benefits, minimum wage rates, individual payroll records, or unrelated laws, are unsupported.

## Retrieval and Gemini

The server applies a topic gate and weighted lexical retrieval before any Gemini call. It includes company scheduling, pay/timekeeping and relevant communication or coaching passages. Reviewed official references provide internal background. The question and retrieved passages are the only request content; employee records are never included.

Generated source IDs, scheduling/pay facts, coaching/write-up guidance where relevant, and timekeeping protections are checked. Invented citations, generated URLs, unsafe withholding statements, default legal comparisons and compliance claims fall back to the company-policy answer. Questions explicitly seeking official requirements receive deterministic policy guidance with reviewed references rather than a generated legal opinion.

GEMINI_API_KEY stays server-side. GEMINI_MODEL defaults to gemini-3.8-flash; verify account availability before deployment. Missing credentials use a clearly labeled source-based response without exposing setup details in the product. Provider timeout, network failure, rate limit, malformed output or invalid citations also produce a source-based fallback. Unsupported questions do not call Gemini.

The API uses a per-server-instance request limit; shared durable limiting is needed before a multi-instance production deployment. This app stores no chat history, but questions sent to Gemini are processed by Google under the configured account’s terms. Avoid personal or sensitive information in questions.
