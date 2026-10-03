/** The Postgres error inside a thrown value: node-postgres sets `code`, Drizzle wraps it in `cause`. */
export function pgError(err: unknown): { code: string; constraint?: string } | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
    }
  }
  return undefined;
}
