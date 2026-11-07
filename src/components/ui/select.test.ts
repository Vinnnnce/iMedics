import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ID = "6f1c2a9e-1111-4222-8333-444455556666";

function render(value: string) {
  return renderToStaticMarkup(
    createElement(
      Select,
      { value },
      createElement(SelectTrigger, null, createElement(SelectValue, { placeholder: "Select patient" })),
      createElement(
        SelectContent,
        null,
        createElement(SelectItem, { value: ID }, "Ada Obi — MC-7K3Q9XPD"),
        createElement(SelectItem, { value: "other" }, "Someone Else — MC-AAAAAAAA"),
      ),
    ),
  );
}

describe("Select", () => {
  it("shows the selected item's label, not its internal id", () => {
    const html = render(ID);
    expect(html).toContain("Ada Obi — MC-7K3Q9XPD");
    // The id may appear as the hidden form value, never as visible trigger text.
    expect(html).not.toMatch(new RegExp(`>${ID}<`));
  });
});
