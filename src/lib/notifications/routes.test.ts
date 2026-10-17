import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ rows: vi.fn(), anchor: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { notification: { findMany: mocks.rows, findFirst: mocks.anchor, count: mocks.count } } }));
vi.mock("@/lib/api", () => {
  return {
    withAuth: (_roles: unknown, handler: (req: Request, ctx: unknown) => unknown) => (req: Request) => handler(req, { user: { id: "signed-in-user" } }),
    parseQuery: (req: Request, schema: { parse: (value: unknown) => unknown }) => schema.parse(Object.fromEntries(new URL(req.url).searchParams)),
  };
});
import { GET } from "@/app/api/notifications/route";
const id = "11111111-1111-4111-8111-111111111111";
describe("notification pagination", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.rows.mockResolvedValue([]); mocks.count.mockResolvedValue(0); });
  const invoke = (query = "") => GET(new NextRequest(`https://care.example/api/notifications${query}`), {} as never);
  it("scopes initial listing and unread counts to the account", async () => {
    await invoke();
    expect(mocks.rows.mock.calls[0][0].where.userId).toBe("signed-in-user");
    expect(mocks.count.mock.calls[0][0].where.userId).toBe("signed-in-user");
  });
  it("uses ascending, stable timestamp-and-id order when polling", async () => {
    const date = new Date("2026-10-16T00:00:00Z");
    mocks.anchor.mockResolvedValue({ id, createdAt: date });
    await invoke(`?after=${id}`);
    const query = mocks.rows.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(query.where.OR).toEqual([{ createdAt: { gt: date } }, { createdAt: date, id: { gt: id } }]);
    expect(mocks.anchor.mock.calls[0][0].where.userId).toBe("signed-in-user");
  });
  it("rejects cursors not owned by the account", async () => {
    mocks.anchor.mockResolvedValue(null);
    await expect(invoke(`?after=${id}`)).rejects.toThrow("Invalid notification cursor");
    expect(mocks.rows).not.toHaveBeenCalled();
  });
  it("returns a bounded batch and continuation cursor without losing older unread events", async () => {
    mocks.anchor.mockResolvedValue({ id, createdAt: new Date() });
    mocks.rows.mockResolvedValue([
      { id: "next-1", data: { toast: false } }, { id: "next-2", data: {} }, { id: "next-3", data: {} },
    ]);
    const body = await (await invoke(`?after=${id}&limit=2`)).json();
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("next-2");
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications[0].toast).toBe(false);
    expect(body.notifications[1].toast).toBe(true);
  });
});
