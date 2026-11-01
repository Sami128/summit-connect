import type { Announcement, AppData, Employee, Receipt, Store, Topic } from './types';

export const stores: Store[] = [
  { id: 'store-1', name: 'Downtown Seattle', city: 'Seattle', address: '401 Pine Street, Seattle, WA', region: 'Seattle & Eastside' },
  { id: 'store-2', name: 'Bellevue Square', city: 'Bellevue', address: '205 Bellevue Way NE, Bellevue, WA', region: 'Seattle & Eastside' },
  { id: 'store-3', name: 'Tacoma Central', city: 'Tacoma', address: '812 Broadway, Tacoma, WA', region: 'South Sound' },
  { id: 'store-4', name: 'Redmond Town Center', city: 'Redmond', address: '16480 NE 74th Street, Redmond, WA', region: 'Seattle & Eastside' },
  { id: 'store-5', name: 'Everett North', city: 'Everett', address: '1017 Broadway, Everett, WA', region: 'North Sound' },
];

export function regionForStore(storeId: string): string { return stores.find(store => store.id === storeId)?.region || 'Other'; }

// Curated fictional names keep natural full-name pairs and varied spelling.
// Name selection never determines a role, permission, department, or store.
const employeeNames = [
  "Michael Bennett",
  "Rachel Chen",
  "Alex Morgan",
  "Sami Ahmady",
  "Mateo García",
  "Kavya Shah",
  "Marcus Brooks",
  "Hana Kim",
  "Omar Farouk",
  "Elena Petrova",
  "Thi Nguyen",
  "Amara Okeke",
  "Luis Mendoza",
  "Haruto Tanaka",
  "Fatima Zahra",
  "Sofia Rossi",
  "Aarav Mehta",
  "Imani Johnson",
  "Jun Park",
  "Leila Mansour",
  "Camila Torres",
  "Noah Williams",
  "Mei Lin",
  "Chinedu Nwosu",
  "Ananya Iyer",
  "Gabriel Silva",
  "Samira Haddad",
  "Élodie Laurent",
  "Daniel Cohen",
  "Nia Robinson",
  "Sora Watanabe",
  "Valentina Rojas",
  "Arjun Nair",
  "Yasmin Ali",
  "Lucas Fischer",
  "Thảo Phạm",
  "Zuri Mensah",
  "Nikolai Ivanov",
  "Isabel Cruz",
  "Ethan O’Connor",
  "Priya Raman",
  "Jamal Edwards",
  "Yuna Sato",
  "Lucía Fernández",
  "Ahmed Khalil",
  "Ingrid Larsen",
  "Rohan Desai",
  "Keisha Thompson",
  "Linh Võ",
  "Andrés Morales",
  "Zainab Yusuf",
  "Oliver Hughes",
  "Nandini Rao",
  "Kwame Boateng",
  "Jia Wei",
  "Marisol Vega",
  "Tariq Saleh",
  "Anika Schneider",
  "Dante Jackson",
  "Sakura Mori",
  "Ana Oliveira",
  "Dev Malhotra",
  "Mariam El-Sayed",
  "Emilia Kowalska",
  "Bao Le",
  "Simone Harris",
  "Farah Rahman",
  "Diego Navarro",
  "Minji Choi",
  "Adeola Adebayo",
  "Rafael Costa",
  "Shreya Kapoor",
  "Malik Washington",
  "Aiko Nakamura",
  "Nadia Ibrahim",
  "Celia Dubois",
  "Vikram Joshi",
  "Chloé Bernard",
  "Javier Ortiz",
  "Grace Campbell",
  "Amina Okafor",
  "Kenji Ito",
  "Sana Siddiqui",
  "Carlos Ramírez",
  "Talia Ben-David",
  "Darius Coleman",
  "Xinyi Huang",
  "Beatriz Santos",
  "Ishaan Gupta",
  "Zahra Karimi",
  "Finn Andersen",
  "Thanh Bùi",
  "Esmeralda López",
  "Kofi Asante",
  "Maya Srinivasan",
  "Youssef Nasser",
  "Hyejin Lee",
  "Alessia Romano",
  "DeShawn Mitchell",
  "Dewi Santoso",
  "Bruno Almeida",
  "Neha Kulkarni",
  "Selin Yılmaz",
  "Jordan Reed",
  "Natsumi Fujita",
  "Chiamaka Eze",
  "Natalia Sokolova",
  "Luca Moretti",
  "Siti Aminah",
  "Hugo Pereira",
  "Aaliyah Davis",
  "Wei Zhang",
  "Parisa Azizi",
  "Aditya Sen",
  "Carmen Ruiz",
  "Naomi Clarke",
  "Daeun Kang",
  "Emil Novak",
  "Chinara Bello",
  "Santiago Reyes",
  "Diego Álvarez",
  "Sahar Mahmoud",
  "Ayumi Kobayashi",
  "Zola Dlamini",
  "Kiran Reddy",
  "Clara Martin",
  "Nur Aisyah",
  "Joaquín Castillo",
  "Andre Lewis",
  "Liang Wu",
  "Amira Hamdan",
  "Anjali Menon",
  "Léa Mercier",
  "Chika Obi",
  "Alejandro Flores",
  "Noura Abbas",
  "Sungmin Han",
  "Sienna Walker",
  "Anil Chatterjee",
  "Tereza Dvořáková",
  "Moussa Diallo",
  "Paula Jiménez",
  "Hiroshi Suzuki",
  "Safiya Ahmed",
  "Tomasz Zieliński",
  "Laila Begum",
  "Rashad Turner",
  "Quynh Trần",
  "Eva Schmidt",
  "Adebisi Adeyemi",
  "Roberto Díaz",
  "Divya Bhat",
  "Soraya Hosseini",
  "Malika Traoré",
  "Kaori Yamamoto",
  "Marta Nowak",
  "Hassan Omar",
  "Tatiana Popescu",
  "Tenzin Dolma",
  "Nicolás Vargas",
  "Minh Tran",
  "Akira Hayashi",
  "Tamika Green",
  "Reem Saad",
  "Manav Arora",
  "Olivia Jensen",
  "Nkechi Umeh",
  "Esteban Herrera",
  "Jiwoo Seo",
  "Sanjana Das",
  "Bashir Abdi",
  "Philippe Moreau",
  "Rani Perera",
  "Dalia Shakir",
  "Benício Souza",
  "Chisomo Banda",
  "Lars Berg",
  "Kyunghee Lim",
  "Dimitri Papadopoulos",
  "Fariha Khan",
  "Mariana Campos",
  "Chandra Wijaya",
  "Elise Van Dijk",
  "Simeon Brown",
  "Tomoko Inoue",
  "Sonia Bansal",
  "Ibrahim Suleiman",
  "Alina Ionescu",
  "Juliana Mendes",
  "Nalin Seneviratne",
  "Pimchanok Chai",
  "Jules Taylor",
  "Rania Darwish",
  "Samuel King",
  "Olena Kovalenko",
  "Zanele Mokoena",
  "Yuri Takahashi",
  "Carolina Fuentes",
  "Samar Qureshi",
  "Avery Foster",
];
const departments = ['Sales', 'Customer Experience', 'Inventory', 'Operations', 'Merchandising'];
const roles: Record<string, string[]> = {
  Sales: ['Sales Associate', 'Senior Sales Associate', 'Sales Lead'],
  'Customer Experience': ['Customer Service Associate', 'Returns Specialist', 'Customer Experience Lead'],
  Inventory: ['Stock Associate', 'Inventory Specialist', 'Receiving Associate'],
  Operations: ['Operations Associate', 'Shift Supervisor', 'Cash Office Associate'],
  Merchandising: ['Visual Merchandiser', 'Merchandising Associate', 'Display Specialist'],
};

export const SCHEDULING_POLICY_DETAILS = "Plan no more than 60 working hours in a Monday–Sunday workweek, counting time worked at all five Summit stores.\n\nBefore accepting extra shifts or swaps that could take you over 60 hours, contact your store manager. Any exception above 60 hours requires prior written approval from the Operations Manager.\n\nRecord all hours you work, including time that was not approved in advance. All hours worked must be paid. Under Summit’s pay policy, overtime-eligible employees receive at least 1.5 times their regular rate for hours worked beyond 40 in the workweek.\n\nViolations of scheduling limits or the approval process result in coaching and a written warning (write-up). Missing approval does not remove payment for hours worked or eligible overtime.\n\nIf your schedule may exceed the limit, or you have a question, speak with your store manager before taking the shift. Please confirm that you have read this policy.";

/** Exact former seed text, used only to upgrade untouched illustrative topics. */
export const LEGACY_GENERAL_TOPIC_DETAILS: Readonly<Record<string, string>> = {
  'topic-safety': 'Share safety procedures, hazard reporting, emergency preparation, and workplace wellbeing updates. Explain the action employees should take and who can answer questions.',
  'topic-operations': 'Share changes to store processes, stockroom access, deliveries, opening and closing routines, and equipment. Include the affected locations, effective date, and next steps.',
  'topic-people': 'Share team news, recognition, benefits reminders, events, and changes that help colleagues stay connected. Include any action needed and the appropriate contact.',
  'topic-customer': 'Share service standards, customer support procedures, product guidance, and ways to create a welcoming store experience. Include clear examples and any next steps.',
};

export function createDefaultTopics(now = new Date()): Topic[] {
  const createdAt = new Date(now.getTime() - 14 * 86400000).toISOString();
  const common = { authorId: 'EMP-0001', createdAt };
  return [
    { ...common, id: 'topic-scheduling', name: '60-hour scheduling policy', kind: 'scheduling', details: SCHEDULING_POLICY_DETAILS },
    { ...common, id: 'topic-safety', name: 'Safety & wellbeing', kind: 'general', details: 'Clear walkways and exits\nKeep customer aisles, emergency exits, receiving corridors, and stockroom walkways clear. Place deliveries and equipment only in designated areas. Tell the shift supervisor if a blocked route cannot be cleared safely.\n\nReporting hazards\nReport spills, damaged equipment, unstable displays, and other hazards to the shift supervisor immediately. Keep others away from the hazard while help is arranged. Do not use damaged equipment or attempt a repair yourself.\n\nSafety questions and huddles\nReview your store’s safety checklist at the start of your shift. Ask the shift supervisor about emergency exits, incident reporting, and any safety instruction you do not understand. Follow the store manager’s instructions for safety huddles and training; reading an update does not replace training.' },
    { ...common, id: 'topic-operations', name: 'Store operations', kind: 'general', details: 'Opening checklist\nReview the store opening checklist and current announcements with the shift supervisor. Check that aisles and exits are clear, displays are ready, and assigned equipment is working. Report missing supplies or equipment problems before starting the affected task.\n\nDeliveries and receiving\nUse the receiving route and delivery area specified in the current store announcement. Check incoming goods against the delivery record and report shortages or damage to the receiving lead. Keep loading corridors and stockroom walkways clear. Ask the shift supervisor if a temporary access change is unclear.\n\nClosing checklist\nComplete the store closing checklist, tidy assigned areas, and return keys and shared equipment to the shift supervisor. Report unfinished tasks or equipment problems during the closing handover. A shift supervisor confirms any change to the closing process; do not assume a topic changes store hours.' },
    { ...common, id: 'topic-people', name: 'People & culture', kind: 'general', details: 'Finding the right contact\nContact your shift supervisor or store manager about everyday work questions, huddles, and announcements. Ask HR about benefits enrollment, workplace support, or a concern you would prefer to discuss privately. Your store manager can help you reach HR.\n\nPay and record questions\nContact payroll about pay statements or a possible time record error. Explain the work dates and the record you want reviewed through the approved payroll process. Do not include personal pay, health, or account information in the assistant chat or a group announcement. This topic does not establish individual pay or benefits eligibility.\n\nRecognition and events\nShare a colleague recognition or event suggestion with your store manager. Follow the dates and participation steps in the specific event announcement. If an enrollment notice has no confirmed deadline or eligibility details, ask HR rather than assuming a date or benefit.' },
    { ...common, id: 'topic-customer', name: 'Customer experience', kind: 'general', details: 'Welcoming customers\nGreet customers warmly, listen to what they need, and offer help without pressure. Keep aisles and displays tidy and accessible. Ask a colleague or the shift supervisor for help when you cannot answer a question.\n\nProduct guidance\nUse the current product guide for product features, care instructions, and launch details. Check with the shift supervisor when the guide does not answer a question. Do not invent product claims, availability, prices, discounts, or launch dates.\n\nReturns and service concerns\nRefer returns, refund requests, and unresolved service concerns to the customer service lead or shift supervisor. Follow the current approved returns procedure and let the authorized colleague confirm the next step. This topic does not specify a return window or promise a refund, exchange, discount, or exception.' },
  ];
}

/** Preserve names, authors, history, scheduling policy, and every edited/custom detail. */
export function upgradeLegacyTopicDetails(topic: Topic, defaults = createDefaultTopics()): Topic {
  const oldDetails = LEGACY_GENERAL_TOPIC_DETAILS[topic.id];
  if (topic.kind !== 'general' || oldDetails === undefined || topic.details !== oldDetails) return topic;
  const replacement = defaults.find(candidate => candidate.id === topic.id && candidate.kind === 'general');
  return replacement ? { ...topic, details: replacement.details } : topic;
}

/** Backward-compatible links for announcements sent before topics were introduced. */
export function legacyTopicId(category: string, announcementId = ''): string {
  if (announcementId === 'ann-scheduling' || /schedul|overtime|60.hour/i.test(category)) return 'topic-scheduling';
  if (/safety|wellbeing/i.test(category)) return 'topic-safety';
  if (/people|culture|benefit|recognition|team.news|company.news/i.test(category)) return 'topic-people';
  if (/customer/i.test(category)) return 'topic-customer';
  return 'topic-operations';
}

export function createSeed(now = new Date()): AppData {
  const employees: Employee[] = Array.from({ length: 200 }, (_, i) => {
    const store = Math.floor(i / 40);
    const local = i % 40;
    const managerIndex = store === 0 ? 1 : store * 40;
    const department = departments[(local + store) % departments.length];
    const accessRole = local === 0 || i === 1 ? 'manager' as const : 'employee' as const;
    return {
      id: `EMP-${String(i + 1).padStart(4, '0')}`,
      name: employeeNames[i],
      storeId: stores[store].id,
      department: accessRole === 'manager' ? 'Operations' : department,
      role: accessRole === 'manager' ? 'Store Manager' : roles[department][i % 3],
      managerId: i === 0 ? null : `EMP-${String(accessRole === 'manager' ? 1 : managerIndex + 1).padStart(4, '0')}`,
      accessRole,
    };
  });
  employees[0] = { ...employees[0], name: 'Michael Bennett', role: 'Operations Manager' };
  employees[1] = { ...employees[1], name: 'Rachel Chen', role: 'Store Manager' };
  employees[2] = { ...employees[2], name: 'Alex Morgan', role: 'Sales Associate', department: 'Sales' };
  employees[3] = { ...employees[3], name: 'Sami Ahmady', role: 'General Manager', department: 'Operations', accessRole: 'manager', managerId: null };
  const at = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 + hours * 3_600_000).toISOString();
  const all = employees.map(e => e.id);
  const announcements: Announcement[] = [
    { id: 'ann-safety', title: 'Holiday safety briefing: a safer season starts with us', body: 'Before our busiest season begins, please review the floor safety checklist. Keep exits and stockroom walkways clear, check ladders before use, and report hazards to your shift supervisor immediately.\n\nEvery team member should attend a 10-minute safety huddle at the start of their next shift. Your manager will walk through emergency exits, incident reporting, and safe lifting.\n\nPlease confirm that you have read this update. If anything is unclear, speak with your manager before your next shift.', category: 'Safety', priority: 'critical', requiresAcknowledgment: true, recipientIds: all, authorId: 'EMP-0001', createdAt: at(2), dueAt: at(-2) },
    { id: 'ann-scheduling', title: 'Your guide to scheduling & overtime', body: SCHEDULING_POLICY_DETAILS, category: 'Policy', priority: 'critical', requiresAcknowledgment: true, recipientIds: all, authorId: 'EMP-0001', createdAt: at(4), dueAt: at(-3) },
    { id: 'ann-weekend', title: 'A little extra magic for the holiday weekend', body: 'Our holiday displays launch this weekend! The visual merchandising guide is ready for your opening huddle. Focus on warm welcomes, thoughtful recommendations, and keeping our seasonal displays tidy.\n\nYour store manager has the full display checklist. Thank you for making every visit feel special.', category: 'Store update', priority: 'routine', requiresAcknowledgment: false, recipientIds: all, authorId: 'EMP-0002', createdAt: at(1), dueAt: null },
    { id: 'ann-benefits', title: 'Benefits open enrollment is coming', body: 'A reminder for the whole team: our fictional benefits enrollment window opens next month. Your store manager will share a simple printed guide during team huddles.\n\nPlease bring questions about the process to your manager. No action is needed today.', category: 'People & culture', priority: 'important', requiresAcknowledgment: false, recipientIds: all, authorId: 'EMP-0001', createdAt: at(5), dueAt: null },
    { id: 'ann-seattle', title: 'Downtown team: updated stockroom access', body: 'Starting with your next shift, please use the east stockroom entrance while we refresh the receiving area. Keep the loading corridor clear and check with Rachel if you need assistance.\n\nConfirm you have read this temporary access change before your next shift.', category: 'Operations', priority: 'critical', requiresAcknowledgment: true, recipientIds: employees.filter(e => e.storeId === 'store-1').map(e => e.id), authorId: 'EMP-0002', createdAt: at(1, 2), dueAt: at(-1) },
    { id: 'ann-recognition', title: '200 teammates. One Summit. Thank you.', body: 'From the first delivery to the last customer of the day, you make Summit what it is. This week we are celebrating the care, energy, and teamwork across all five stores.\n\nShare a teammate shout-out at your next store huddle. We are grateful for everything you do.', category: 'People & culture', priority: 'routine', requiresAcknowledgment: false, recipientIds: all, authorId: 'EMP-0001', createdAt: at(7), dueAt: null },
  ];
  const topics = createDefaultTopics(now);
  announcements.forEach(announcement => { announcement.topicId = legacyTopicId(announcement.category, announcement.id); });
  const receipts: Receipt[] = [];
  announcements.forEach((announcement, ai) => {
    announcement.recipientIds.forEach((employeeId, ei) => {
      if (employeeId === 'EMP-0003' && ai < 3) return;
      const score = (ei * 17 + ai * 11) % 100;
      const read = score < [88, 92, 71, 80, 78, 95][ai];
      if (!read) return;
      const readAt = new Date(new Date(announcement.createdAt).getTime() + (ei % 18 + 1) * 60_000).toISOString();
      const acknowledgedAt = announcement.requiresAcknowledgment && score < [76, 84, 0, 0, 63, 0][ai] ? new Date(new Date(readAt).getTime() + 90_000).toISOString() : null;
      receipts.push({ announcementId: announcement.id, employeeId, readAt, acknowledgedAt });
    });
  });
  return { employees, stores, topics, announcements, receipts, mode: 'local' };
}
