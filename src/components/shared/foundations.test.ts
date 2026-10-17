import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState, ErrorState, DashboardSkeleton } from "./async-state";
import { FormField } from "./form-field";
import { LineChart } from "./line-chart";
import { StatusChip } from "./status-chip";
import { DataTable } from "./data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("accessible shared foundations", () => {
  it("renders contextual empty and error states", () => {
    expect(renderToStaticMarkup(createElement(EmptyState, { title: "No results" }))).toContain("No results");
    expect(renderToStaticMarkup(createElement(ErrorState))).toContain('role="alert"');
  });
  it("announces loading once and hides decorative skeletons", () => {
    const html = renderToStaticMarkup(createElement(DashboardSkeleton));
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your dashboard");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("motion-reduce:animate-none");
  });
  it("links form labels, hints, and errors to the control", () => {
    const props = {
      label: "Name", hint: "Enter your name", error: "Name required",
      children: createElement("input", { id: "name" }),
    };
    const html = renderToStaticMarkup(createElement(FormField, props));
    expect(html).toContain('for="name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-hint name-error"');
  });
  it("never conveys status by color alone", () => {
    const props = { tone: "danger" as const, children: "Review required" };
    expect(renderToStaticMarkup(createElement(StatusChip, props))).toContain("Review required");
  });
  it("renders exact chart values as a semantic alternative to the SVG", () => {
    const html = renderToStaticMarkup(createElement(LineChart, { title: "Trend", unit: "units", points: [{ label: "Monday", value: 7 }, { label: "Tuesday", value: 7 }] }));
    expect(html).toContain('role="img"');
    expect(html).toContain("<table");
    expect(html).toContain('scope="row"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("handles absent and invalid chart values without broken geometry", () => {
    const html = renderToStaticMarkup(createElement(LineChart, { title: "Trend", points: [{ label: "Invalid", value: NaN }] }));
    expect(html).toContain("No chart data");
    expect(html).not.toContain("<svg");
  });
  it("supports the single-value chart case", () => {
    const html = renderToStaticMarkup(createElement(LineChart, { title: "Trend", points: [{ label: "Today", value: 3 }] }));
    expect(html).toContain('cx="300"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("renders data table loading, error, and empty branches", () => {
    const props = { rows: [], columns: [], rowKey: () => "id", caption: "Bookings" };
    expect(renderToStaticMarkup(createElement(DataTable, { ...props, loading: true }))).toContain("Loading Bookings");
    expect(renderToStaticMarkup(createElement(DataTable, { ...props, error: "Unavailable" }))).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(DataTable, props))).toContain("No matching records");
  });
  it.each(["horizontal", "vertical"] as const)("passes %s orientation to the tabs primitive", orientation => {
    const html = renderToStaticMarkup(createElement(Tabs, { orientation, defaultValue: "one" },
      createElement(TabsList, null, createElement(TabsTrigger, { value: "one" }, "One")),
      createElement(TabsContent, { value: "one" }, "Content")));
    expect(html).toContain(`data-orientation="${orientation}"`);
    expect(html).toContain('role="tablist"');
    expect(html).toContain("data-[orientation=horizontal]:flex-col");
  });
});
