import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request database tenant context, the application half of Postgres row-level security.
 *
 * `withAuth` opens a store for every API request. Once a request has proven which facility it is
 * acting for (`requireFacilityAccess`), it records that facility here. The database pool
 * (see db-pool.ts) then tells Postgres, so the row-level policies on clinical tables confine
 * every later query in that request to the one facility, even if a route forgets its own
 * `facilityId` filter.
 *
 * The facility id lives in a mutable store rather than being "entered" with enterWith, because
 * enterWith does not survive returning from the async function that called it.
 */
export interface RlsStore { facilityId: string | null }

const storage = new AsyncLocalStorage<RlsStore>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function runWithRlsContext<T>(fn: () => T): T {
  return storage.run({ facilityId: null }, fn);
}

/** Confine the rest of this request to one facility. Ignored outside a request store. */
export function setFacilityContext(facilityId: string): void {
  const store = storage.getStore();
  if (store && UUID.test(facilityId)) store.facilityId = facilityId.toLowerCase();
}

export function currentFacilityContext(): string | null {
  return storage.getStore()?.facilityId ?? null;
}
