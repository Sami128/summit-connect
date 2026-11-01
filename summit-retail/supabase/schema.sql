-- Run once in the Supabase SQL editor. Only the server's service role can access data.
-- No public/anonymous access is required; browser requests use authenticated Next.js APIs.
create table if not exists public.stores (
  id text primary key,
  name text not null,
  city text not null,
  address text not null,
  region text not null default 'Other'
);

alter table public.stores add column if not exists region text not null default 'Other';
update public.stores set region = case
  when id in ('store-1', 'store-2', 'store-4') then 'Seattle & Eastside'
  when id = 'store-5' then 'North Sound'
  when id = 'store-3' then 'South Sound'
  else 'Other' end
where region = 'Other';

create table if not exists public.employees (
  id text primary key,
  name text not null check (char_length(name) between 2 and 100),
  role text not null,
  department text not null,
  store_id text not null references public.stores(id),
  manager_id text references public.employees(id) deferrable initially deferred,
  access_role text not null default 'employee' check (access_role in ('manager', 'employee'))
);

create table if not exists public.employee_auth (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique references public.employees(id) on delete cascade
);

create table if not exists public.topics (
  id text primary key,
  name text not null check (char_length(name) between 3 and 80 and name = btrim(name)),
  details text not null check (char_length(details) between 10 and 12000),
  kind text not null default 'general' check (kind in ('scheduling', 'general')),
  author_id text not null references public.employees(id),
  created_at timestamptz not null default now()
);
create unique index if not exists topics_name_unique_idx on public.topics(lower(name));

create table if not exists public.announcements (
  id text primary key,
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 10 and 10000),
  category text not null,
  topic_id text references public.topics(id),
  priority text not null check (priority in ('critical', 'important', 'routine')),
  requires_acknowledgment boolean not null default false,
  author_id text not null references public.employees(id),
  created_at timestamptz not null default now(),
  due_at timestamptz,
  check (priority = 'critical' or not requires_acknowledgment),
  check (due_at is null or (requires_acknowledgment and due_at > created_at))
);

-- Safe upgrade for existing installations: leave records and receipt history intact.
alter table public.announcements add column if not exists topic_id text references public.topics(id);

create table if not exists public.announcement_recipients (
  announcement_id text not null references public.announcements(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  primary key (announcement_id, employee_id)
);

create table if not exists public.receipts (
  announcement_id text not null,
  employee_id text not null,
  read_at timestamptz,
  acknowledged_at timestamptz,
  primary key (announcement_id, employee_id),
  constraint receipts_announcement_fkey foreign key (announcement_id) references public.announcements(id) on delete cascade,
  constraint receipts_employee_fkey foreign key (employee_id) references public.employees(id) on delete cascade,
  check (acknowledged_at is null or (read_at is not null and acknowledged_at >= read_at))
);

-- Manager visibility includes non-targeted announcements. Keep receipts separate
-- from the delivery audience; the receipt RPC below still checks role and action.
do $$
declare old_constraint record;
begin
  for old_constraint in select conname from pg_constraint
    where conrelid = 'public.receipts'::regclass and contype = 'f'
      and confrelid = 'public.announcement_recipients'::regclass
  loop
    execute format('alter table public.receipts drop constraint %I', old_constraint.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.receipts'::regclass and conname = 'receipts_announcement_fkey') then
    alter table public.receipts add constraint receipts_announcement_fkey foreign key (announcement_id) references public.announcements(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.receipts'::regclass and conname = 'receipts_employee_fkey') then
    alter table public.receipts add constraint receipts_employee_fkey foreign key (employee_id) references public.employees(id) on delete cascade;
  end if;
end;
$$;

create index if not exists announcement_recipients_employee_idx on public.announcement_recipients(employee_id);
create index if not exists employees_store_idx on public.employees(store_id);
create index if not exists receipts_employee_idx on public.receipts(employee_id);

alter table public.stores enable row level security;
alter table public.employees enable row level security;
alter table public.employee_auth enable row level security;
alter table public.topics enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.receipts enable row level security;

revoke all on public.stores, public.employees, public.employee_auth, public.topics, public.announcements, public.announcement_recipients, public.receipts from anon, authenticated;
grant all on public.stores, public.employees, public.employee_auth, public.topics, public.announcements, public.announcement_recipients, public.receipts to service_role;


-- Backfill existing seeded installations without changing messages or employee records.
with existing_author as (
  select id from public.employees where access_role = 'manager'
  order by case when id = 'EMP-0001' then 0 else 1 end, id limit 1
), defaults(id, name, kind, details) as (values
  ('topic-scheduling', '60-hour scheduling policy', 'scheduling', $topic$Plan no more than 60 working hours in a Monday–Sunday workweek, counting time worked at all five Summit stores.

Before accepting extra shifts or swaps that could take you over 60 hours, contact your store manager. Any exception above 60 hours requires prior written approval from the Operations Manager.

Record all hours you work, including time that was not approved in advance. All hours worked must be paid. Under Summit’s pay policy, overtime-eligible employees receive at least 1.5 times their regular rate for hours worked beyond 40 in the workweek.

Violations of scheduling limits or the approval process result in coaching and a written warning (write-up). Missing approval does not remove payment for hours worked or eligible overtime.

If your schedule may exceed the limit, or you have a question, speak with your store manager before taking the shift. Please confirm that you have read this policy.$topic$),
  ('topic-safety', 'Safety & wellbeing', 'general', $topic$Share safety procedures, hazard reporting, emergency preparation, and workplace wellbeing updates. Explain the action employees should take and who can answer questions.$topic$),
  ('topic-operations', 'Store operations', 'general', $topic$Share changes to store processes, stockroom access, deliveries, opening and closing routines, and equipment. Include the affected locations, effective date, and next steps.$topic$),
  ('topic-people', 'People & culture', 'general', $topic$Share team news, recognition, benefits reminders, events, and changes that help colleagues stay connected. Include any action needed and the appropriate contact.$topic$),
  ('topic-customer', 'Customer experience', 'general', $topic$Share service standards, customer support procedures, product guidance, and ways to create a welcoming store experience. Include clear examples and any next steps.$topic$)
)
insert into public.topics(id, name, kind, details, author_id)
select defaults.id, defaults.name, defaults.kind, defaults.details, existing_author.id
from defaults cross join existing_author
on conflict do nothing;

-- Upgrade only untouched illustrative playbooks; preserve all custom details and metadata.
with replacements(id, old_details, new_details) as (values
  ('topic-safety', 'Share safety procedures, hazard reporting, emergency preparation, and workplace wellbeing updates. Explain the action employees should take and who can answer questions.', 'Clear walkways and exits
Keep customer aisles, emergency exits, receiving corridors, and stockroom walkways clear. Place deliveries and equipment only in designated areas. Tell the shift supervisor if a blocked route cannot be cleared safely.

Reporting hazards
Report spills, damaged equipment, unstable displays, and other hazards to the shift supervisor immediately. Keep others away from the hazard while help is arranged. Do not use damaged equipment or attempt a repair yourself.

Safety questions and huddles
Review your store’s safety checklist at the start of your shift. Ask the shift supervisor about emergency exits, incident reporting, and any safety instruction you do not understand. Follow the store manager’s instructions for safety huddles and training; reading an update does not replace training.'),
  ('topic-operations', 'Share changes to store processes, stockroom access, deliveries, opening and closing routines, and equipment. Include the affected locations, effective date, and next steps.', 'Opening checklist
Review the store opening checklist and current announcements with the shift supervisor. Check that aisles and exits are clear, displays are ready, and assigned equipment is working. Report missing supplies or equipment problems before starting the affected task.

Deliveries and receiving
Use the receiving route and delivery area specified in the current store announcement. Check incoming goods against the delivery record and report shortages or damage to the receiving lead. Keep loading corridors and stockroom walkways clear. Ask the shift supervisor if a temporary access change is unclear.

Closing checklist
Complete the store closing checklist, tidy assigned areas, and return keys and shared equipment to the shift supervisor. Report unfinished tasks or equipment problems during the closing handover. A shift supervisor confirms any change to the closing process; do not assume a topic changes store hours.'),
  ('topic-people', 'Share team news, recognition, benefits reminders, events, and changes that help colleagues stay connected. Include any action needed and the appropriate contact.', 'Finding the right contact
Contact your shift supervisor or store manager about everyday work questions, huddles, and announcements. Ask HR about benefits enrollment, workplace support, or a concern you would prefer to discuss privately. Your store manager can help you reach HR.

Pay and record questions
Contact payroll about pay statements or a possible time record error. Explain the work dates and the record you want reviewed through the approved payroll process. Do not include personal pay, health, or account information in the assistant chat or a group announcement. This topic does not establish individual pay or benefits eligibility.

Recognition and events
Share a colleague recognition or event suggestion with your store manager. Follow the dates and participation steps in the specific event announcement. If an enrollment notice has no confirmed deadline or eligibility details, ask HR rather than assuming a date or benefit.'),
  ('topic-customer', 'Share service standards, customer support procedures, product guidance, and ways to create a welcoming store experience. Include clear examples and any next steps.', 'Welcoming customers
Greet customers warmly, listen to what they need, and offer help without pressure. Keep aisles and displays tidy and accessible. Ask a colleague or the shift supervisor for help when you cannot answer a question.

Product guidance
Use the current product guide for product features, care instructions, and launch details. Check with the shift supervisor when the guide does not answer a question. Do not invent product claims, availability, prices, discounts, or launch dates.

Returns and service concerns
Refer returns, refund requests, and unresolved service concerns to the customer service lead or shift supervisor. Follow the current approved returns procedure and let the authorized colleague confirm the next step. This topic does not specify a return window or promise a refund, exchange, discount, or exception.')
)
update public.topics as topic set details = replacements.new_details
from replacements
where topic.id = replacements.id
  and topic.kind = 'general'
  and topic.details = replacements.old_details;

update public.announcements set topic_id = case
  when id = 'ann-scheduling' or category ~* '(schedul|overtime|60.hour)' then 'topic-scheduling'
  when category ~* '(safety|wellbeing)' then 'topic-safety'
  when category ~* '(people|culture|benefit|recognition|team.news|company.news)' then 'topic-people'
  when category ~* 'customer' then 'topic-customer'
  else 'topic-operations' end
where topic_id is null
  and exists (select 1 from public.topics where id = 'topic-operations');

create or replace function public.summit_create_announcement(p_announcement jsonb, p_author_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  chosen_topic public.topics;
begin
  if not exists (select 1 from public.employees where id = p_author_id and access_role = 'manager') then
    raise exception 'Only managers can send announcements';
  end if;
  if jsonb_array_length(p_announcement->'recipientIds') < 1 then
    raise exception 'An audience is required';
  end if;
  select * into chosen_topic from public.topics where id = p_announcement->>'topicId';
  if not found then raise exception 'Choose an existing topic'; end if;
  insert into public.announcements(id, title, body, category, topic_id, priority, requires_acknowledgment, author_id, created_at, due_at)
  values (p_announcement->>'id', p_announcement->>'title', p_announcement->>'body', chosen_topic.name, chosen_topic.id, p_announcement->>'priority', (p_announcement->>'requiresAcknowledgment')::boolean, p_author_id, (p_announcement->>'createdAt')::timestamptz, (p_announcement->>'dueAt')::timestamptz);
  insert into public.announcement_recipients(announcement_id, employee_id)
  select p_announcement->>'id', employee_id from jsonb_array_elements_text(p_announcement->'recipientIds') as recipients(employee_id);
end;
$$;

create or replace function public.summit_record_receipt(p_announcement_id text, p_employee_id text, p_action text)
returns public.receipts language plpgsql security definer set search_path = public, pg_temp as $$
declare
  requires_ack boolean;
  recipient_role text;
  is_targeted boolean := false;
  announcement_author text;
  author_role text;
  author_access_role text;
  existing public.receipts;
  result public.receipts;
begin
  if p_action is null or p_action not in ('read', 'acknowledge') then raise exception 'Invalid receipt action'; end if;
  select access_role into recipient_role from public.employees where id = p_employee_id;
  if not found then raise exception 'Announcement not available'; end if;
  select a.requires_acknowledgment, a.author_id, author.role, author.access_role,
    exists (select 1 from public.announcement_recipients r where r.announcement_id = a.id and r.employee_id = p_employee_id)
  into requires_ack, announcement_author, author_role, author_access_role, is_targeted
  from public.announcements a join public.employees author on author.id = a.author_id
  where a.id = p_announcement_id;
  if not found then raise exception 'Announcement not available'; end if;
  if is_targeted is not true and not (p_action = 'read' and recipient_role = 'manager') then raise exception 'Announcement not available'; end if;
  if p_action = 'acknowledge' and not requires_ack then raise exception 'Announcement does not require acknowledgment'; end if;
  if p_action = 'acknowledge' and (announcement_author = p_employee_id or (recipient_role = 'manager' and (author_access_role <> 'manager' or lower(btrim(author_role)) <> 'general manager'))) then
    raise exception 'Confirmation is not required for you on this announcement';
  end if;
  select * into existing from public.receipts where announcement_id = p_announcement_id and employee_id = p_employee_id for update;
  if p_action = 'acknowledge' and (existing.read_at is null) then raise exception 'Read before acknowledging'; end if;
  insert into public.receipts(announcement_id, employee_id, read_at, acknowledged_at)
  values (p_announcement_id, p_employee_id, now(), case when p_action = 'acknowledge' then now() else null end)
  on conflict (announcement_id, employee_id) do update
  set read_at = coalesce(public.receipts.read_at, excluded.read_at),
      acknowledged_at = coalesce(public.receipts.acknowledged_at, excluded.acknowledged_at)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.summit_create_announcement(jsonb, text) from public, anon, authenticated;
revoke all on function public.summit_record_receipt(text, text, text) from public, anon, authenticated;
grant execute on function public.summit_create_announcement(jsonb, text) to service_role;
grant execute on function public.summit_record_receipt(text, text, text) to service_role;

-- After creating users through Supabase Auth, link their trusted identities:
-- insert into public.employee_auth(user_id, employee_id) values ('<auth-user-uuid>', 'EMP-0003');
-- Never use auth user_metadata to grant manager permissions.
