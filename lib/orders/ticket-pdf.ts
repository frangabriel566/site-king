import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { TICKET_FONT, type TicketBlock } from "./ticket";

const MM = 72 / 25.4;
const PAGE_WIDTH = 80 * MM;
const MARGIN_X = 4 * MM;
const MARGIN_Y = 3 * MM;
const INDENT = 15;
const BOX = 9;
const LINE_HEIGHT = 1.28;
const BLACK = rgb(0, 0, 0);
/**
 * O driver da térmica usa papel de 80 x 297 mm e centraliza nele qualquer
 * página menor, o que abria um vão em cima da nota. Com a página nessa
 * altura, a nota começa no topo; o papel em branco fica todo no fim.
 */
const PAPER_HEIGHT = 297 * MM;

/** Helvetica só tem o alfabeto latino: emoji e afins somem em vez de quebrar a nota. */
function printable(text: string, font: PDFFont) {
  return Array.from(text.replace(/\s+/g, " ").trim())
    .filter((char) => {
      try {
        font.encodeText(char);
        return true;
      } catch {
        return false;
      }
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= width;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    let rest = word;
    const joined = line ? `${line} ${rest}` : rest;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    // Palavra maior que a linha (um e-mail longo, por exemplo) quebra no meio.
    while (!fits(rest)) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

type Draw = (page: PDFPage, top: number) => void;

function layout(blocks: TicketBlock[], font: PDFFont) {
  const draws: Draw[] = [];
  const right = PAGE_WIDTH - MARGIN_X;
  let y = MARGIN_Y;

  const line = (x0: number, x1: number, at: number, dash?: number[]) =>
    draws.push((page, top) =>
      page.drawLine({
        start: { x: x0, y: top - at },
        end: { x: x1, y: top - at },
        thickness: 1.5,
        color: BLACK,
        dashArray: dash,
      }),
    );
  const text = (value: string, x: number, at: number, size: number) =>
    draws.push((page, top) =>
      page.drawText(value, { x, y: top - at - size, size, font, color: BLACK }),
    );

  for (const block of blocks) {
    if (block.kind === "divider") {
      y += 6;
      line(MARGIN_X, right, y, [4, 3]);
      y += 7;
    } else if (block.kind === "rule") {
      y += 3;
      line(MARGIN_X, right, y);
      y += 4;
    } else if (block.kind === "space") {
      y += block.height;
    } else if (block.kind === "writeLine") {
      y += 24;
      line(MARGIN_X, right, y);
    } else if (block.kind === "text") {
      const size = block.size ?? TICKET_FONT.body;
      const x = MARGIN_X + (block.indent || block.checkbox ? INDENT : 0);
      const lines = wrap(printable(block.text, font), font, size, right - x);
      if (block.checkbox) {
        const at = y;
        draws.push((page, top) =>
          page.drawRectangle({
            x: MARGIN_X + 0.75,
            y: top - at - BOX - 0.75,
            width: BOX,
            height: BOX,
            borderWidth: 1.5,
            borderColor: BLACK,
          }),
        );
      }
      for (const value of lines) {
        const width = font.widthOfTextAtSize(value, size);
        text(
          value,
          block.align === "center" ? (PAGE_WIDTH - width) / 2 : x,
          y,
          size,
        );
        y += size * LINE_HEIGHT;
      }
    } else {
      const size = block.size ?? TICKET_FONT.body;
      const x = MARGIN_X + (block.indent ? INDENT : 0);
      const value = printable(block.right, font);
      const valueWidth = font.widthOfTextAtSize(value, size);
      text(value, right - valueWidth, y, size);
      const lines = wrap(
        printable(block.left, font),
        font,
        size,
        right - x - valueWidth - 6,
      );
      for (const left of lines) {
        text(left, x, y, size);
        y += size * LINE_HEIGHT;
      }
    }
  }
  return { draws, height: Math.max(y + MARGIN_Y, PAPER_HEIGHT) };
}

/** PDF da notinha: 80 mm de largura, começando no topo do papel. */
export async function buildTicketPdf(blocks: TicketBlock[], title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { draws, height } = layout(blocks, font);
  const page = pdf.addPage([PAGE_WIDTH, height]);
  for (const draw of draws) draw(page, height);
  return pdf.save();
}
