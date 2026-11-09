import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildTicketPdf } from "@/lib/orders/ticket-pdf";
import type { TicketBlock } from "@/lib/orders/ticket";

const base: TicketBlock[] = [
  { kind: "text", text: "KING STORE", align: "center" },
  { kind: "divider" },
  { kind: "text", text: "1x CAMISA LACOSTE 👕 GOLA LISTRADA", checkbox: true },
  { kind: "row", left: "R$ 129,90 un.", right: "R$ 129,90", indent: true },
];

async function pageOf(blocks: TicketBlock[]) {
  const pdf = await PDFDocument.load(
    await buildTicketPdf(blocks, "Pedido KS0019"),
  );
  expect(pdf.getPageCount()).toBe(1);
  return pdf.getPage(0);
}

describe("buildTicketPdf", () => {
  it("makes one 80 mm page, even with emoji in a product name", async () => {
    expect((await pageOf(base)).getWidth()).toBeCloseTo((80 * 72) / 25.4);
  });

  it("grows the paper with the content", async () => {
    const small = (await pageOf(base)).getHeight();
    const long: TicketBlock[] = [
      ...base,
      { kind: "text", text: "a@".repeat(200) },
    ];
    expect((await pageOf(long)).getHeight()).toBeGreaterThan(small);
  });
});
