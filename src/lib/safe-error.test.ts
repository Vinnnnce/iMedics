import { describe, expect, it } from "vitest";
import { safeErrorMetadata } from "./safe-error";
describe("privacy-safe error diagnostics", () => {
  it("never serializes messages, stack content, arbitrary names or provider details", () => {
    const error = Object.assign(new Error("patient Jane; bearer SECRET; SQL clinical payload"), { name: "Patient Jane", code: "SECRET_VALUE", details: { patientName: "Jane" } });
    expect(safeErrorMetadata(error)).toEqual({ kind: "UnknownError" });
  });
  it("retains only bounded technical Prisma identifiers", () => {
    const error = Object.assign(new Error("private payload"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    expect(safeErrorMetadata(error)).toEqual({ kind: "PrismaClientKnownRequestError", code: "P2002" });
  });
});
