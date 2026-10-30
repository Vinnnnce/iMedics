/** Never log exception messages, stacks, SQL parameters or provider bodies:
 * any of those may contain clinical data or credentials. */
export function safeErrorMetadata(error: unknown) {
  const names = new Set(["Error", "TypeError", "RangeError", "AbortError", "TimeoutError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientInitializationError", "PrismaClientValidationError"]);
  const kind = error instanceof Error && names.has(error.name) ? error.name : "UnknownError";
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code) ? error.code : undefined;
  return { kind, ...(code ? { code } : {}) };
}
