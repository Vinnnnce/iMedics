// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

import { StaffAccessControl, StaffManager } from "./staff-manager";
import { apiClient } from "@/lib/api-client";

const staffRow = {
  id: "staff-1", email: "team@example.org", fullName: "Sample Scientist", facilityRole: "LAB_SCIENTIST",
  status: "ACTIVE", accessLevel: "LIMITED", customCategory: null,
  department: { name: "Haematology" }, branch: null,
  publicProfileVisible: false, profileConsent: true, bookingEligible: false,
  professionalTitle: null, specialty: null, userId: null, acceptedAt: null, lastLoginAt: null,
  credentials: [],
};

const apiBase = () => ({
  get: vi.fn().mockResolvedValue({ staff: { patientAccessGrants: [] } }),
  post: vi.fn().mockResolvedValue({ ok: true }),
  patch: vi.fn().mockResolvedValue({ ok: true }),
  refresh: vi.fn(),
});

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe("StaffAccessControl patient lookup", () => {
  it("looks the patient up by caseNumber (not the broken ?n= parameter)", async () => {
    const base = apiBase();
    base.get.mockImplementation(async (url: string) =>
      url.startsWith("/facility/patients")
        ? { patient: { id: "p1", firstName: "Ada", lastName: "Example" } }
        : { staff: { patientAccessGrants: [] } });
    render(createElement(StaffAccessControl, {
      staffId: "staff-1", accessLevel: "LIMITED", customCategory: null, canManageStaff: true, apiBase: base,
    }));
    await act(async () => { fireEvent.click(screen.getByTestId("button-access-staff-1")); });

    fireEvent.change(screen.getByLabelText("Assign patient by case number"), { target: { value: "QA-123456" } });
    fireEvent.change(screen.getByLabelText("Grant or revocation justification"), { target: { value: "Covering the on-call haematology shift tonight." } });
    await act(async () => { fireEvent.click(screen.getByText("Grant access")); });

    expect(base.get).toHaveBeenCalledWith("/facility/patients?caseNumber=QA-123456");
    expect(base.post).toHaveBeenCalledWith("/facility/staff/staff-1/access", {
      action: "GRANT", patientId: "p1", scope: "CARE_TEAM", justification: "Covering the on-call haematology shift tonight.",
    });
    expect(screen.getByText(/Access granted to Ada Example/)).toBeTruthy();
  });

  it("shows the server's message when no patient matches the case number", async () => {
    const base = apiBase();
    base.get.mockImplementation(async (url: string) =>
      url.startsWith("/facility/patients") ? { patient: null } : { staff: { patientAccessGrants: [] } });
    render(createElement(StaffAccessControl, {
      staffId: "staff-1", accessLevel: "LIMITED", customCategory: null, canManageStaff: true, apiBase: base,
    }));
    await act(async () => { fireEvent.click(screen.getByTestId("button-access-staff-1")); });

    fireEvent.change(screen.getByLabelText("Assign patient by case number"), { target: { value: "QA-000000" } });
    fireEvent.change(screen.getByLabelText("Grant or revocation justification"), { target: { value: "Testing the error message path." } });
    await act(async () => { fireEvent.click(screen.getByText("Grant access")); });

    expect(screen.getByRole("alert").textContent).toContain("No patient matches that case number");
  });
});

describe("StaffManager error messages", () => {
  it("surfaces the concrete server error, never a bare 'Failed'", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Could not reach the patient directory"));
    render(createElement(StaffManager, {
      staff: [staffRow], departments: [], branches: [], canManageStaff: true,
    }));
    await act(async () => { fireEvent.click(screen.getByTestId("button-access-staff-1")); });
    expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the patient directory");
  });
});
