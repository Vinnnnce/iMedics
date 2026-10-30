import { createElement, type ComponentProps, type MouseEvent } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { capture, assign } = vi.hoisted(() => ({ capture: vi.fn(), assign: vi.fn() }));
vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => { capture(props); return createElement("a", null, "Test entry"); },
}));
import { PublicEntryLink } from "./public-entry-link";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { origin: "https://app.test", assign } });
});
afterEach(() => vi.unstubAllGlobals());
function entry(href: string, extras: Partial<ComponentProps<typeof PublicEntryLink>> = {}) {
  renderToString(createElement(PublicEntryLink, { href, ...extras }, "Test entry"));
  return capture.mock.calls.at(-1)![0] as ComponentProps<typeof PublicEntryLink>;
}
function click(props: ComponentProps<typeof PublicEntryLink>, changes: Record<string, unknown> = {}) {
  const url = new URL(String(props.href), "https://app.test");
  const event = {
    button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    currentTarget: { href: url.href, origin: url.origin, pathname: url.pathname, hasAttribute: () => false },
    preventDefault: vi.fn(), ...changes,
  };
  props.onClick?.(event as unknown as MouseEvent<HTMLAnchorElement>);
  return event;
}
describe("anonymous public entry links", () => {
  it("disables prefetch even when a caller tries to enable it", () => {
    expect(entry("/doctors", { prefetch: true }).prefetch).toBe(false);
  });
  it.each(["/doctors", "/patient/results", "https://app.test/facilities"])("uses a full-page auth navigation for %s", (href) => {
    const event = click(entry(href));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(new URL(href, "https://app.test").href);
  });
  it.each(["/hospitals", "/emergency", "https://example.com/resource"])("preserves ordinary navigation for %s", (href) => {
    expect(click(entry(href)).preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
  it("preserves modified clicks, new tabs, downloads and canceled clicks", () => {
    for (const changes of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      expect(click(entry("/doctors"), changes).preventDefault).not.toHaveBeenCalled();
    }
    expect(click(entry("/doctors", { target: "_blank" })).preventDefault).not.toHaveBeenCalled();
    expect(click(entry("/doctors"), { currentTarget: { hasAttribute: () => true } }).preventDefault).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
  it("runs the caller click handler first and honors its cancellation", () => {
    const handler = vi.fn((event: MouseEvent<HTMLAnchorElement>) => { Object.defineProperty(event, "defaultPrevented", { value: true }); });
    click(entry("/doctors", { onClick: handler }));
    expect(handler).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
  });
});
