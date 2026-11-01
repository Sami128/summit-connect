import { createSeed } from '../src/lib/seed';
import { createSupabase } from '../src/lib/supabase';

try { process.loadEnvFile('.env.local'); } catch { /* Environment can also be supplied by the shell. */ }

async function main(): Promise<void> {
  const db = createSupabase();
  const { count, error } = await db.from('employees').select('*', { count: 'exact', head: true });
  if (error) throw new Error('Unable to reach the employees table. Apply supabase/schema.sql and check server environment variables.');
  if (count) throw new Error('This database already contains employees. No changes were made. Use a separate, empty Supabase project for this synthetic seed.');
  const seed = createSeed();
  const rows: [string, Record<string, unknown>[]][] = [
    ['stores', seed.stores],
    ['employees', seed.employees.map(e => ({ id: e.id, name: e.name, role: e.role, department: e.department, store_id: e.storeId, manager_id: e.managerId, access_role: e.accessRole }))],
    ['topics', seed.topics.map(topic => ({ id: topic.id, name: topic.name, details: topic.details, kind: topic.kind, author_id: topic.authorId, created_at: topic.createdAt }))],
    ['announcements', seed.announcements.map(a => ({ id: a.id, title: a.title, body: a.body, category: a.category, topic_id: a.topicId, priority: a.priority, requires_acknowledgment: a.requiresAcknowledgment, author_id: a.authorId, created_at: a.createdAt, due_at: a.dueAt }))],
    ['announcement_recipients', seed.announcements.flatMap(a => a.recipientIds.map(employeeId => ({ announcement_id: a.id, employee_id: employeeId })))],
    ['receipts', seed.receipts.map(r => ({ announcement_id: r.announcementId, employee_id: r.employeeId, read_at: r.readAt, acknowledged_at: r.acknowledgedAt }))],
  ];
  for (const [table, records] of rows) {
    const result = await db.from(table).insert(records);
    if (result.error) throw new Error(`Seed failed while writing ${table}. Inspect the Supabase SQL editor; no credentials were printed.`);
  }
  console.log('Seeded 200 synthetic employees, 5 stores, 5 topics, 6 announcements, and example read/acknowledgment history.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
