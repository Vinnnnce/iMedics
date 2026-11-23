import { randomUUID } from "node:crypto";

/**
 * The investigation tables declare neither `@default(uuid())` on `id` nor `@updatedAt`
 * on `updated_at`, so every write that needs them supplies them explicitly.
 */
export const newId = (): string => randomUUID();

/** Spread into `data` of any `update` / `updateMany` on a table that has `updated_at`. */
export const touch = () => ({ updated_at: new Date() });

/** Spread into `data` of any `create` on a table that has `updated_at`: a fresh id and timestamp. */
export const newRow = () => ({ id: newId(), updated_at: new Date() });
