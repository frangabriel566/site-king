export function AnnouncementBar({
  text,
  active,
}: {
  text: string | null;
  active: boolean;
}) {
  if (!active || !text) return null;

  return (
    <div className="border-b border-line bg-bg px-8 py-2 text-center">
      <p className="text-label !text-fg">{text}</p>
    </div>
  );
}
