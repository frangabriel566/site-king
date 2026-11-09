/**
 * O conteúdo da notinha, numa lista só: a mesma lista desenha a prévia na
 * tela e o PDF que vai para a impressora, para os dois nunca divergirem.
 */
export type TicketBlock =
  | {
      kind: "text";
      text: string;
      size?: number;
      align?: "left" | "center";
      indent?: boolean;
      checkbox?: boolean;
    }
  | {
      kind: "row";
      left: string;
      right: string;
      size?: number;
      indent?: boolean;
    }
  | { kind: "divider" }
  | { kind: "rule" }
  | { kind: "space"; height: number }
  | { kind: "writeLine" };

export const TICKET_FONT = {
  small: 9,
  body: 10.5,
  total: 12.75,
  title: 16.5,
} as const;
