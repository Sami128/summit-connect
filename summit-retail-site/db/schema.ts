import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// A revisioned document preserves the existing application contract while D1
// atomically coordinates writes across independent Worker instances.
export const summitState = sqliteTable('summit_state', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
  schemaVersion: integer('schema_version').notNull().default(1),
});
