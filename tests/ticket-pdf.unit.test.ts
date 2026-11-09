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

  it("fills the 297 mm paper, so the driver has nothing to centre", async () => {
    expect((await pageOf(base)).getHeight()).toBeCloseTo((297 * 72) / 25.4);
  });

  it("grows past the paper for a long order instead of cutting it", async () => {
    const long: TicketBlock[] = [...base, ...Array<TicketBlock>(80).fill(base[2])];
    expect((await pageOf(long)).getHeight()).toBeGreaterThan((297 * 72) / 25.4);
  });
});
