/**
 * Birthdays of the store's customers (Vendas na loja → Clientes): who has
 * one coming up, and the WhatsApp message offering the birthday discount.
 * Pure functions — the dates are local "YYYY-MM-DD" strings
 * (lib/store-sales/period.ts), never Date objects in the Worker's UTC.
 */

/** "{nome}" becomes the customer's first name, "{loja}" the store's name. */
export const DEFAULT_BIRTHDAY_MESSAGE =
  "Feliz aniversário, {nome}! 🎉 Para comemorar, a {loja} preparou um desconto especial para você. Passe na loja ou responda esta mensagem para aproveitar!";

export const BIRTHDAY_MESSAGE_MAX = 600;

/** How far ahead the "Aniversariantes" list looks. */
export const BIRTHDAY_WINDOW_DAYS = 30;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
}

/** The birthday in a given year — 29/02 falls on 28/02 outside leap years. */
function birthdayIn(year: number, birthdate: string): string {
  const monthDay = birthdate.slice(5, 10);
  return `${year}-${monthDay === "02-29" && !isLeapYear(year) ? "02-28" : monthDay}`;
}

export type BirthdayInfo = {
  /** The next birthday, today included (YYYY-MM-DD). */
  date: string;
  /** 0 = today. */
  daysUntil: number;
  /** The age the customer turns on that day. */
  turning: number;
};

export function nextBirthday(birthdate: string, today: string): BirthdayInfo {
  const year = Number(today.slice(0, 4));
  let date = birthdayIn(year, birthdate);
  if (date < today) date = birthdayIn(year + 1, birthdate);
  return {
    date,
    daysUntil: dayNumber(date) - dayNumber(today),
    turning: Number(date.slice(0, 4)) - Number(birthdate.slice(0, 4)),
  };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function buildBirthdayMessage(
  template: string | null,
  { name, storeName }: { name: string; storeName: string },
): string {
  return (template?.trim() || DEFAULT_BIRTHDAY_MESSAGE)
    .replaceAll("{nome}", firstName(name))
    .replaceAll("{loja}", storeName);
}

/** wa.me for a Brazilian number stored as digits with DDD. */
export function customerWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** "26/10" */
export function formatDayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}
