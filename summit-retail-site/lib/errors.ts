export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error('[Summit API]', error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[endpoint]') : 'Unexpected failure');
  return Response.json({ error: 'We could not complete that request. Please try again.' }, { status: 500 });
}
