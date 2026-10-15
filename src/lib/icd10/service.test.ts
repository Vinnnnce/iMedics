import { describe, expect, it } from "vitest";
import { buildDiagnosisRows } from "./service";

describe("buildDiagnosisRows", () => {
  it("rejects more than one diagnosis for a consultation", async () => {
    await expect(
      buildDiagnosisRows([
        { code: "I10", isPrimary: true },
        { code: "E11.9" },
      ]),
    ).rejects.toThrow("A consultation can have only one ICD-10 diagnosis.");
  });
});
