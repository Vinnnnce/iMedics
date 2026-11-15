import pg from "pg";
import { currentFacilityContext } from "./rls-context";

/**
 * A pg pool that carries the request's facility into Postgres for row-level security.
 *
 * The setting is transaction-local (`set_config(..., true)`), never session-level, so it is safe
 * behind a transaction-pooling proxy such as Neon's pooled endpoint and cannot leak to the next
 * request that reuses a connection. Without a facility context nothing extra is sent.
 *
 *  - Single statements: BEGIN + set_config in one round trip, the statement, then COMMIT. Reads
 *    do not wait for the COMMIT; writes always do, so a failed commit is never reported as success.
 *  - Interactive transactions (Prisma `$transaction(fn)` and batches): Prisma issues BEGIN itself;
 *    a hook on each physical connection follows it with set_config.
 */
const SET_CONFIG_SQL = "SELECT set_config('app.facility_id', $1, true)";

function sqlText(first: unknown): string | undefined {
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "text" in first) return String((first as { text: unknown }).text);
  return undefined;
}

export class FacilityContextPool extends pg.Pool {
  constructor(config: pg.PoolConfig) {
    super(config);
    this.on("connect", (client: pg.PoolClient) => {
      const original = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
        const facilityId = currentFacilityContext();
        const last = args[args.length - 1];
        if (!facilityId || typeof last === "function" || sqlText(args[0]) !== "BEGIN") return original(...args);
        return (original(...args) as Promise<unknown>).then(async (result) => {
          await original(SET_CONFIG_SQL, [facilityId]);
          return result;
        });
      };
    });
  }

  // pg's Pool.query is heavily overloaded; Prisma's adapter only uses the promise form.
  query(...args: unknown[]): never {
    const facilityId = currentFacilityContext();
    const base = (super.query as (...a: unknown[]) => unknown).bind(this);
    if (!facilityId || typeof args[args.length - 1] === "function") return base(...args) as never;
    return this.queryInContext(facilityId, args) as never;
  }

  private async queryInContext(facilityId: string, args: unknown[]): Promise<unknown> {
    const client = await this.connect();
    // The connect hook only reacts to a bare "BEGIN", so this combined statement is sent as is.
    const raw = (client.query as (...a: unknown[]) => Promise<unknown>).bind(client);
    let released = false;
    const release = (error?: Error) => { if (!released) { released = true; client.release(error); } };
    try {
      await raw(`BEGIN; SELECT set_config('app.facility_id', '${facilityId}', true)`);
      const result = await raw(...args);
      const readOnly = /^\s*(select|with)\b/i.test(sqlText(args[0]) ?? "") && !/\b(insert|update|delete)\b/i.test(sqlText(args[0]) ?? "");
      const commit = raw("COMMIT");
      if (readOnly) commit.then(() => release(), (error) => release(error as Error));
      else { await commit; release(); }
      return result;
    } catch (error) {
      await raw("ROLLBACK").catch(() => undefined);
      release(error as Error);
      throw error;
    }
  }
}
