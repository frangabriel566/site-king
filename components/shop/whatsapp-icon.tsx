export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* Speech-bubble ring + tail */}
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7.6 19 5 22.5l4.7-2.4z" fill="currentColor" />
      {/* Handset, centered inside the ring */}
      <path
        d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.05 15.05 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1c0 9.39 7.61 17 17 17a1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1z"
        fill="currentColor"
        transform="translate(6 6) scale(0.5)"
      />
    </svg>
  );
}
