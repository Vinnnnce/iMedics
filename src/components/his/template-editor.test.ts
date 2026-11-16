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

import { TemplateEditor } from "./template-editor";
import { api } from "./use-api";
import { parseDefinition, type TemplateDefinition } from "@/lib/his/template-schema";

const DND_MIME = "application/x-medic1905-template";
const payloadOf = (payload: unknown) => ({ dataTransfer: { getData: (mime: string) => (mime === DND_MIME ? JSON.stringify(payload) : "") } });
const dragTransfer = () => ({ setData: vi.fn(), effectAllowed: "" });

const definition = parseDefinition({
  sections: [
    { id: "s1", title: "History", fields: [{ id: "f1", label: "Chief complaint", type: "text", required: true }, { id: "f2", label: "Notes", type: "textarea" }] },
    { id: "s2", title: "Findings", fields: [{ id: "f3", label: "Locked finding", type: "text", required: true, locked: true }] },
  ],
  signatures: [],
});
const setup = (def: TemplateDefinition = definition) => render(createElement(TemplateEditor, {
  templateId: "t1", name: "Test template", status: "DRAFT", version: 1, definition: def,
  editable: true, canApprove: false, canManage: true, history: [],
  letterheads: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Main hospital", department: null },
    { id: "22222222-2222-4222-8222-222222222222", name: "Radiology", department: "Radiology" },
  ],
}));
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByTestId("button-save-template")); });
  return vi.mocked(api).mock.calls[0]?.[1]?.body as { definition: TemplateDefinition };
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe("drag-and-drop template builder", () => {
  it("adds a field when a palette chip is dropped into a section", async () => {
    vi.mocked(api).mockResolvedValue({});
    setup();
    fireEvent.dragStart(screen.getByTestId("palette-select"), { dataTransfer: dragTransfer() });
    fireEvent.dragOver(screen.getByTestId("section-drop-s2"));
    fireEvent.drop(screen.getByTestId("section-drop-s2"), payloadOf({ kind: "new-field", type: "select" }));
    const saved = await save();
    const findings = saved.definition.sections.find((s) => s.id === "s2")!;
    // Dragged-in select fields get options immediately so they validate.
    expect(findings.fields.map((f) => f.type)).toEqual(["text", "select"]);
    expect(findings.fields[1].options).toEqual(["Option 1"]);
  });

  it("moves a field between sections when dropped on another field's row", async () => {
    vi.mocked(api).mockResolvedValue({});
    setup();
    const grip = screen.getAllByTitle("Drag to move this field")[0];
    fireEvent.dragStart(grip, { dataTransfer: dragTransfer() });
    const targetRow = screen.getByDisplayValue("Locked finding").closest("div")!.parentElement!;
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow, payloadOf({ kind: "move-field", sectionId: "s1", fieldId: "f2" }));
    const saved = await save();
    // f2 moved out of s1 and landed after f3 in s2 (jsdom drops resolve to "after").
    expect(saved.definition.sections.find((s) => s.id === "s1")!.fields.map((f) => f.id)).toEqual(["f1"]);
    expect(saved.definition.sections.find((s) => s.id === "s2")!.fields.map((f) => f.id)).toEqual(["f3", "f2"]);
  });

  it("reorders sections when a section grip is dropped on another section", async () => {
    vi.mocked(api).mockResolvedValue({});
    setup();
    fireEvent.dragStart(screen.getAllByTitle("Drag to reorder this section")[0], { dataTransfer: dragTransfer() });
    const card = screen.getByTestId("section-drop-s2").parentElement!;
    fireEvent.dragOver(card);
    fireEvent.drop(card, payloadOf({ kind: "move-section", sectionId: "s1" }));
    const saved = await save();
    // s1 was dropped after s2 → the order flips.
    expect(saved.definition.sections.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  it("keeps locked fields undeletable and keeps the palette hidden in read-only mode", () => {
    setup();
    const lockedRow = screen.getByDisplayValue("Locked finding").closest("div")!.parentElement!;
    expect(lockedRow.querySelector("button[aria-label='Remove field']")!.hasAttribute("disabled")).toBe(true);
    cleanup();
    render(createElement(TemplateEditor, {
      templateId: "t1", name: "Test template", status: "PUBLISHED", version: 1, definition,
      editable: false, canApprove: false, canManage: true, history: [],
      letterheads: [{ id: "11111111-1111-4111-8111-111111111111", name: "Main hospital", department: null }],
    }));
    expect(screen.queryByTestId("field-palette")).toBeNull();
    expect(screen.queryByTestId("button-save-template")).toBeNull();
  });

  it("pins a saved letterhead on the template output settings", async () => {
    setup();
    const select = screen.getByLabelText("Letterhead for documents from this template");
    expect(select).toBeTruthy();
    await act(async () => { fireEvent.change(select, { target: { value: "22222222-2222-4222-8222-222222222222" } }); });
    const saved = await save();
    expect(saved?.definition.output.letterheadId).toBe("22222222-2222-4222-8222-222222222222");
  });

});
