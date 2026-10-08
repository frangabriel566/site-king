import { describe, expect, it } from "vitest";
import { formatCustomerName } from "@/lib/format";

describe("formatCustomerName", () => {
  it.each([
    ["Carlos Mendes", "Carlos M."],
    ["Carlos Eduardo Mendes", "Carlos M."],
    ["Maria de Souza", "Maria S."],
    ["Ana Paula dos Santos", "Ana S."],
    ["  joão   silva  ", "João S."],
    ["Pedro", "Pedro"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(formatCustomerName(input)).toBe(expected);
  });
});
