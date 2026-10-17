import { describe, expect, it } from "vitest";
import { transitionAllowed, allowedWorkflowTargets, ACTIVE_WORKFLOW_STAGES } from "./facility-workflow";
import type { FacilityBookingWorkflowStage as S } from "@prisma/client";

describe("facility booking workflow", () => {
  it("walks the laboratory path in order", () => {
    const path: S[] = ["BOOKED", "CHECKED_IN", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "PROCESSING", "RESULT_ENTERED", "VERIFIED", "RELEASED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(transitionAllowed(path[i], path[i + 1])).not.toBeNull();
    }
  });

  it("walks the diagnostic path in order", () => {
    const path: S[] = ["BOOKED", "CHECKED_IN", "PROCEDURE_COMPLETED", "IMAGES_UPLOADED", "REPORT_DRAFTED", "REVIEWED", "RELEASED"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(transitionAllowed(path[i], path[i + 1])).not.toBeNull();
    }
  });

  it("supports approval where required before release", () => {
    expect(transitionAllowed("VERIFIED", "APPROVED")).not.toBeNull();
    expect(transitionAllowed("APPROVED", "RELEASED")).not.toBeNull();
  });

  it("supports amendment after release and archiving", () => {
    expect(transitionAllowed("RELEASED", "AMENDED")).not.toBeNull();
    expect(transitionAllowed("AMENDED", "RELEASED")).not.toBeNull();
    expect(transitionAllowed("RELEASED", "ARCHIVED")).not.toBeNull();
  });

  it("rejects skips and reversals", () => {
    expect(transitionAllowed("BOOKED", "RELEASED")).toBeNull();
    expect(transitionAllowed("BOOKED", "PROCESSING")).toBeNull();
    expect(transitionAllowed("PROCESSING", "SAMPLE_COLLECTED")).toBeNull();
    expect(transitionAllowed("ARCHIVED", "RELEASED")).toBeNull();
    expect(transitionAllowed("CHECKED_IN", "BOOKED")).toBeNull();
  });

  it("gates each step by a role permission", () => {
    const targets = allowedWorkflowTargets("PROCESSING");
    expect(targets).toHaveLength(1);
    expect(targets[0].permission).toBe("ENTER_RESULTS");

    const release = transitionAllowed("VERIFIED", "RELEASED");
    expect(release?.permission).toBe("RELEASE_RESULTS");
  });

  it("keeps all active stages in the result queue", () => {
    expect(ACTIVE_WORKFLOW_STAGES).not.toContain("RELEASED");
    expect(ACTIVE_WORKFLOW_STAGES).not.toContain("ARCHIVED");
    expect(ACTIVE_WORKFLOW_STAGES).toContain("RESULT_ENTERED");
  });
});
