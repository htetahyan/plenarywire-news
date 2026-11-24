/** Section-balanced pending selection so one busy feed (e.g. NASA) cannot fill every run. */

export const SECTION_ROTATION = ["us-politics", "eu-politics", "world", "economy-policy", "tech"] as const;

export type Selectable = {
  default_section: string;
  mode?: string;
  published_at?: string | null;
  first_seen_at?: string | null;
};

/** Official-rewrite before facts-only (avoids burning slots on uncorroborated tips); then newer first. */
function rankKey(r: Selectable): [number, number] {
  const t = Date.parse(String(r.published_at || r.first_seen_at || 0)) || 0;
  const modeRank = r.mode === "facts-only" ? 1 : 0;
  return [modeRank, -t];
}

/**
 * Round-robin across sections until `budget` is filled.
 * `rotate` shifts which section is offered the first slot (use run id or UTC hour).
 */
export function pickSectionBalanced<T extends Selectable>(rows: T[], budget: number, rotate = 0): T[] {
  if (budget <= 0 || !rows.length) return [];
  const bySec = new Map<string, T[]>();
  for (const r of rows) {
    const s = r.default_section || "world";
    const list = bySec.get(s) || [];
    list.push(r);
    bySec.set(s, list);
  }
  for (const list of bySec.values()) {
    list.sort((a, b) => {
      const [ta, ma] = rankKey(a);
      const [tb, mb] = rankKey(b);
      return ta - tb || ma - mb;
    });
  }
  const known = SECTION_ROTATION.filter((s) => bySec.has(s));
  const extra = [...bySec.keys()].filter((s) => !SECTION_ROTATION.includes(s as (typeof SECTION_ROTATION)[number])).sort();
  const base = [...known, ...extra];
  if (!base.length) return [];
  const rot = ((rotate % base.length) + base.length) % base.length;
  const order = [...base.slice(rot), ...base.slice(0, rot)];
  const idx: Record<string, number> = Object.fromEntries(order.map((s) => [s, 0]));
  const out: T[] = [];
  while (out.length < budget) {
    let added = false;
    for (const s of order) {
      if (out.length >= budget) break;
      const list = bySec.get(s) || [];
      const i = idx[s] || 0;
      if (i < list.length) {
        out.push(list[i]);
        idx[s] = i + 1;
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
