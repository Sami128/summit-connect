import { requireSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { getBootstrap, getData } from '@/lib/store';
import { readJson, text } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only view of an associate's feed. The caller remains signed in as the manager. */
export async function POST(request: Request): Promise<Response> {
  const respond = (response: Response) => {
    response.headers.set('Cache-Control', 'no-store');
    return withAuthCookies(request, response);
  };
  try {
    verifyMutation(request);
    const session = await requireSession(request);
    if (session.role !== 'manager') throw new ApiError(403, 'Only managers can preview an associate workspace.');
    const input = await readJson(request);
    const employeeId = text(input.employeeId, 'Employee', 1, 80);
    const roster = await getData();
    const employee = roster.employees.find(person => person.id === employeeId);
    if (!employee) throw new ApiError(404, 'This employee could not be found. Refresh the directory and try again.');
    if (employee.accessRole !== 'employee') throw new ApiError(400, 'Choose an associate to preview their workspace.');
    const manager = roster.employees.find(person => person.id === session.employeeId);
    if (!manager || manager.accessRole !== 'manager') throw new ApiError(403, 'Your manager access is unavailable. Please sign in again.');

    const data = await getBootstrap({ employeeId, role: 'employee', demo: session.demo });
    return respond(Response.json({ data, manager: { id: manager.id, name: manager.name } }));
  } catch (error) { return respond(toErrorResponse(error)); }
}
