// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./use-api", () => ({ api: vi.fn(), inputClass: "", textareaClass: "" }));
vi.mock("@/components/ui/button", () => ({ Button: (props: Record<string, unknown>) => {
  const native = { ...props };
  delete native.size; delete native.variant;
  return createElement("button", native, props.children as never);
} }));

import { DocumentEditor } from "./document-editor";
import { api } from "./use-api";
import { parseDefinition } from "@/lib/his/template-schema";
import type { DocumentView } from "@/lib/his/documents";

const FILE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const view = {
  id: "document", status: "DRAFT", statusLabel: "Draft", sensitivity: "STANDARD", content: {},
  definition: parseDefinition({ sections: [{ id: "s", title: "Clinical note", fields: [
    { id: "note", label: "Note", type: "text" }, { id: "file", label: "Supporting report", type: "attachment", required: true },
  ] }] }), signatures: [], events: [], missingSignatureLabels: [],
} as unknown as DocumentView;
const setup = () => render(createElement(DocumentEditor, {
  view, isAuthor: true, perms: { author: true, review: false, sign: true, approve: false, release: false },
  mediaOptions: [{ id: FILE, fileName: "Synthetic report.pdf", mimeType: "application/pdf", sensitivity: "STANDARD" }],
}));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("document authoring", () => {
  it("saves the chosen patient file reference rather than a URL or file name", async () => {
    vi.mocked(api).mockResolvedValue({});
    setup();
    fireEvent.change(screen.getByLabelText("Supporting report *"), { target: { value: FILE } });
    await act(async () => { fireEvent.click(screen.getByText("Save", { selector: "button" })); });
    expect(api).toHaveBeenCalledWith("/api/facility/his/documents/document", { method: "PUT", body: { content: { file: FILE }, autosave: false } });
  });
  it("keeps newer edits dirty when an earlier autosave completes", async () => {
    let finish!: (value: Record<string, never>) => void;
    vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve as typeof finish; }));
    setup();
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "First edit" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Second edit" } });
    await act(async () => { finish({}); });
    expect(screen.getByText("Unsaved changes…")).toBeTruthy();
    vi.mocked(api).mockResolvedValue({});
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(api).toHaveBeenLastCalledWith("/api/facility/his/documents/document", { method: "PUT", body: { content: { note: "Second edit" }, autosave: true } });
  });
  it("waits for autosave before saving the latest draft and submitting", async () => {
    let finish!: (value: Record<string, never>) => void;
    vi.mocked(api).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve as typeof finish; }));
    setup();
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "First edit" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Latest edit" } });
    fireEvent.click(screen.getByText("Submit", { selector: "button" }));
    expect(api).toHaveBeenCalledTimes(1);
    vi.mocked(api).mockResolvedValue({});
    await act(async () => { finish({}); });
    expect(api).toHaveBeenNthCalledWith(2, "/api/facility/his/documents/document", { method: "PUT", body: { content: { note: "Latest edit" }, autosave: false } });
    expect(api).toHaveBeenNthCalledWith(3, "/api/facility/his/documents/document/actions", { body: { action: "submit" } });
  });
  it("serializes multiple queued autosaves with explicit submission", async () => {
    let finishFirst!: (value: Record<string, never>) => void;
    let finishSecond!: (value: Record<string, never>) => void;
    vi.mocked(api)
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve as typeof finishFirst; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishSecond = resolve as typeof finishSecond; }));
    setup();
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "First edit" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Second edit" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    fireEvent.click(screen.getByText("Submit", { selector: "button" }));
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({}); });
    expect(api).toHaveBeenCalledTimes(2);
    vi.mocked(api).mockResolvedValue({});
    await act(async () => { finishSecond({}); });
    expect(api).toHaveBeenCalledTimes(4);
    expect(api).toHaveBeenNthCalledWith(4, "/api/facility/his/documents/document/actions", { body: { action: "submit" } });
  });
});
