export function WhatsAppFloat({
  phone,
  message = "Olá! Vim do site da King Store.",
}: {
  phone: string | null;
  message?: string;
}) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center bg-white text-black transition-transform duration-200 ease-out hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
        <path d="M12.017 0h-.034C5.396 0 0 5.398 0 12.017c0 2.652.86 5.106 2.318 7.098L0 24l5.062-1.325a11.94 11.94 0 0 0 5.897 1.548h.006c6.62 0 12.017-5.399 12.017-12.017C23 5.398 17.639.024 12.017 0zM19.9 17.169a5.62 5.62 0 0 1-2.396 2.472c-1.03.582-2.155.879-3.28.879a12.51 12.51 0 0 1-5.146-1.113l-.369-.186-3.804.997.998-3.703-.202-.373a9.9 9.9 0 0 1-1.144-4.65c0-5.462 4.451-9.913 9.916-9.913 2.649 0 5.14 1.03 7.008 2.9a9.85 9.85 0 0 1 2.9 7.013c0 .952-.13 1.888-.386 2.775z" />
      </svg>
    </a>
  );
}
