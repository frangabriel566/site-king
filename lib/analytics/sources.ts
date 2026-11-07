/**
 * GA4's session source/medium → the groups the panel shows. Instagram and
 * Facebook arrive under several names (the in-app browsers, the link
 * shims, "ig", "fb"), so they are folded into one row each; any other
 * source GA4 identified keeps its own name.
 */

export type TrafficSource = {
  key: string;
  label: string;
  sessions: number;
  users: number;
};

const GROUPS: { key: string; label: string; test: (source: string, medium: string) => boolean }[] = [
  { key: "direto", label: "Acesso direto", test: (s) => s === "(direct)" },
  { key: "instagram", label: "Instagram", test: (s) => /(^|\.)instagram\.com$|^instagram$|^ig$/.test(s) },
  {
    key: "facebook",
    label: "Facebook",
    test: (s) => /(^|\.)facebook\.com$|^facebook$|^fb$|^(m|l|lm)\.facebook\.com$/.test(s),
  },
  { key: "google", label: "Google", test: (s) => /(^|\.)google\.[a-z.]+$|^google$/.test(s) },
  {
    key: "whatsapp",
    label: "WhatsApp",
    test: (s) => /whatsapp|^wa\.me$|^l\.wl\.co$/.test(s),
  },
  { key: "tiktok", label: "TikTok", test: (s) => /tiktok/.test(s) },
];

export function classifySource(source: string, medium = ""): { key: string; label: string } {
  const s = source.trim().toLowerCase();
  const m = medium.trim().toLowerCase();
  for (const group of GROUPS) if (group.test(s, m)) return { key: group.key, label: group.label };
  if (!s || s === "(not set)") return { key: "nao_identificado", label: "Não identificado" };
  return { key: `outro:${s}`, label: s };
}

/**
 * Rows of (sessionSource, sessionMedium, sessions, users) → one row per
 * group, largest first. Beyond `keep` rows, the smallest identified
 * sources are summed as "Outras fontes".
 */
export function groupSources(
  rows: { source: string; medium: string; sessions: number; users: number }[],
  keep = 8,
): TrafficSource[] {
  const groups = new Map<string, TrafficSource>();
  for (const row of rows) {
    const { key, label } = classifySource(row.source, row.medium);
    const group = groups.get(key) ?? { key, label, sessions: 0, users: 0 };
    group.sessions += row.sessions;
    group.users += row.users;
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => b.sessions - a.sessions);
  if (sorted.length <= keep) return sorted;
  const head = sorted.slice(0, keep - 1);
  const rest = sorted.slice(keep - 1);
  return [
    ...head,
    {
      key: "outras",
      label: "Outras fontes",
      sessions: rest.reduce((sum, r) => sum + r.sessions, 0),
      users: rest.reduce((sum, r) => sum + r.users, 0),
    },
  ];
}
