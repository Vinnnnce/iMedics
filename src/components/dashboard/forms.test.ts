import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
/** Regression for Base UI buttons defaulting to type=button, including hidden tab panels. */
describe("dashboard form submit controls", () => {
  it.each(["patient", "doctor", "facility", "admin", "intelligence", "tasks", "documents", "payments"])("%s forms have explicit submit buttons", name => {
    const file = path.join(process.cwd(), `src/components/dashboard/${name}.tsx`);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const forms: ts.JsxElement[] = [];
    function find(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "form") forms.push(node);
      ts.forEachChild(node, find);
    }
    find(source);
    for (const form of forms) {
      let submits = 0;
      function check(node: ts.Node) {
        const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
        if (opening && ["Button", "button"].includes(opening.tagName.getText(source))) {
          if (opening.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === "type" && attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === "submit")) submits++;
        }
        ts.forEachChild(node, check);
      }
      check(form);
      expect(submits, `${name} form at position ${form.pos} needs an explicit submit button`).toBeGreaterThan(0);
    }
  });
});
