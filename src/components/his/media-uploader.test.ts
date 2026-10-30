// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./use-api", () => ({ api: vi.fn(), inputClass: "" }));
vi.mock("./patient-identify", () => ({ PatientIdentify: ({ onFound }: { onFound: (p: unknown) => void }) => createElement("div", null,
  ...["a", "b"].map((id) => createElement("button", { key: id, onClick: () => onFound({ id, caseNumber: `QA-${id}`, firstName: "Synthetic", lastName: id, dateOfBirth: "1990-01-01", gender: "OTHER" }) }, `Select ${id}`)),
) }));
import { MediaUploader } from "./media-uploader";
import { api } from "./use-api";

class Upload {
  static instances: Upload[] = [];
  status = 200; timeout = 0;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload = () => {}; onerror = () => {}; ontimeout = () => {};
  open() {} setRequestHeader() {}
  send() { Upload.instances.push(this); }
}
let seq = 0;
const file = (n: number) => {
  const f = new File(["%PDF-1.7 synthetic"], `synthetic-${n}.pdf`, { type: "application/pdf" });
  Object.defineProperty(f, "arrayBuffer", { value: async () => new ArrayBuffer(16) });
  return f;
};
beforeEach(() => {
  vi.clearAllMocks(); Upload.instances = []; seq = 0;
  vi.stubGlobal("XMLHttpRequest", Upload);
  vi.stubGlobal("crypto", { randomUUID: () => `queue-${++seq}`, subtle: { digest: async () => new ArrayBuffer(32) } });
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/api/facility/his/media" && options?.body) return { key: "synthetic-key", uploadUrl: "https://storage.invalid/upload" } as never;
    return { media: [] } as never;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("bounded patient-scoped diagnostic upload queue", () => {
  it("runs at most two uploads and starts the next only when a slot completes", async () => {
    const { container } = render(createElement(MediaUploader, { canUpload: true, canRelease: false }));
    fireEvent.click(screen.getByText("Select a"));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file(1), file(2), file(3)] } });
    await waitFor(() => expect(Upload.instances).toHaveLength(2));
    expect(screen.getByText("queued")).toBeTruthy();
    await act(async () => Upload.instances[0].onload());
    await waitFor(() => expect(Upload.instances).toHaveLength(3));
  });
  it("retains original patient and metadata after a patient change and retry", async () => {
    const { container } = render(createElement(MediaUploader, { canUpload: true, canRelease: false }));
    fireEvent.click(screen.getByText("Select a"));
    fireEvent.change(screen.getByLabelText("Examination type"), { target: { value: "Original synthetic examination" } });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file(1)] } });
    await waitFor(() => expect(Upload.instances).toHaveLength(1));
    fireEvent.click(screen.getByText("change"));
    fireEvent.click(screen.getByText("Select b"));
    fireEvent.change(screen.getByLabelText("Examination type"), { target: { value: "Different patient examination" } });
    await act(async () => Upload.instances[0].onerror());
    fireEvent.click(await screen.findByText("Retry"));
    await waitFor(() => expect(Upload.instances).toHaveLength(2));
    await act(async () => Upload.instances[1].onload());
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/facility/his/media/confirm", expect.objectContaining({
      body: expect.objectContaining({ patientId: "a", examinationType: "Original synthetic examination" }),
    })));
  });
  it("rejects unsupported files before hashing or requesting an upload URL", async () => {
    const { container } = render(createElement(MediaUploader, { canUpload: true, canRelease: false }));
    fireEvent.click(screen.getByText("Select a"));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["unsafe"], "unsafe.exe", { type: "application/x-msdownload" })] } });
    expect(await screen.findByText(/not permitted|not supported|unsupported/i)).toBeTruthy();
    expect(Upload.instances).toHaveLength(0);
    expect(vi.mocked(api).mock.calls.filter(([, options]) => options?.body)).toHaveLength(0);
  });
});
