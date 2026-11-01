import type { Announcement, Employee } from './types';

type TargetedAnnouncement = Pick<Announcement, 'requiresAcknowledgment' | 'recipientIds' | 'authorId'>;
type Recipient = Pick<Employee, 'id' | 'accessRole'>;
type Author = Pick<Employee, 'id' | 'accessRole' | 'role'>;

/** Associates confirm targeted requests; managers confirm targeted General Manager requests. */
export function confirmationRequired(announcement: TargetedAnnouncement, employee: Recipient | undefined, employees: readonly Author[] = []): boolean {
  if (!announcement.requiresAcknowledgment || !employee || employee.id === announcement.authorId || !announcement.recipientIds.includes(employee.id)) return false;
  if (employee.accessRole === 'employee') return true;
  const author = employees.find(candidate => candidate.id === announcement.authorId);
  return author?.accessRole === 'manager' && author.role.trim().toLocaleLowerCase('en-US') === 'general manager';
}

/** Reading access never adds a manager to the selected confirmation audience. */
export function acknowledgmentRecipientIds(announcement: TargetedAnnouncement, employees: readonly Author[]): string[] {
  if (!announcement.requiresAcknowledgment) return [];
  const directory = new Map(employees.map(employee => [employee.id, employee]));
  return announcement.recipientIds.filter(id => confirmationRequired(announcement, directory.get(id), employees));
}
