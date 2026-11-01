export type Employee = {
  id: string; name: string; role: string; department: string; storeId: string;
  managerId: string | null; accessRole: 'manager' | 'employee';
};
export type Store = { id: string; name: string; city: string; address: string; region?: string };
export type Topic = { id: string; name: string; details: string; kind: 'scheduling' | 'general'; authorId: string; createdAt: string };
export type Announcement = {
  id: string; title: string; body: string; category: string; topicId?: string;
  priority: 'critical' | 'important' | 'routine'; requiresAcknowledgment: boolean;
  recipientIds: string[]; authorId: string; createdAt: string; dueAt: string | null;
};
export type Receipt = { announcementId: string; employeeId: string; readAt: string | null; acknowledgedAt: string | null };
export type AppData = { employees: Employee[]; stores: Store[]; topics: Topic[]; announcements: Announcement[]; receipts: Receipt[]; mode: 'local' | 'd1' | 'supabase' };
export type Session = { employeeId: string; role: 'manager' | 'employee'; demo: boolean };
export type Bootstrap = AppData & { session: Session; identities: Pick<Employee, 'id' | 'name' | 'role' | 'storeId' | 'accessRole'>[] };
export type AnnouncementInput = Pick<Announcement, 'title' | 'body' | 'priority' | 'requiresAcknowledgment' | 'recipientIds' | 'dueAt' | 'topicId'> & { category?: string };
export type AssistantSource = { id: string; title: string; kind: 'company' | 'law'; url: string; passage: string };
export type AssistantAnswer = { answer: string; sources: AssistantSource[]; mode: 'gemini' | 'openai' | 'retrieval' | 'unsupported'; notice?: string };
