import { describe, expect, it } from "vitest";
import { codeSchema, emailSchema, safeNextPath } from "./schemas";
import { friendlyDbError } from "./dbErrors";

describe("safeNextPath", () => {
  it.each([
    ["/team", "/team"],
    ["/invite/abc?x=1", "/invite/abc?x=1"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["team", "/"],
    [undefined, "/"],
    [["/team"], "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("emailSchema / codeSchema", () => {
  it("normalizes email", () => {
    expect(emailSchema.parse("  Pat@Example.TEST ")).toBe("pat@example.test");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("accepts only 6 digits", () => {
    expect(codeSchema.parse(" 123456 ")).toBe("123456");
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("friendlyDbError", () => {
  it("shows our own messages", () => {
    expect(friendlyDbError({ code: "23505", message: "You already belong to a firm." })).toBe(
      "You already belong to a firm.",
    );
  });

  it("hides raw database errors", () => {
    expect(friendlyDbError({ code: "23505", message: 'duplicate key value violates unique constraint "x"' })).toMatch(
      /Something went wrong/,
    );
    expect(friendlyDbError({ code: "42P01", message: "relation does not exist" })).toMatch(/Something went wrong/);
    expect(friendlyDbError(null)).toMatch(/Something went wrong/);
  });
});
