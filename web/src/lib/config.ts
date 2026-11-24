import cfg from "@/generated/config.json";

export type Brand = {
  name: string; shortName: string; tagline: string;
  wordmark: { primary: string; accent: string; separator?: string };
  deskName: string; themeColorLight: string; themeColorDark: string; manifestThemeColor: string;
  colors: { accent: string; accentDark: string; ink: string; inkDark: string; markTop: string; markBottom: string; signal: string };
  logo: { mark: string; full: string; png512: string; og: string; publisher: string };
};
export type LogoPaths = { viewBox: string; primary: string; accent: string; width: number };
export type Topic = { name: string; short?: string; description: string };

export const brand: Brand = cfg.brand as Brand;
export const LOGO: LogoPaths = cfg.logo as LogoPaths;
export const TOPICS: Record<string, Topic> = cfg.topics;
export const SECTION_KEYS = Object.keys(TOPICS);
export const SITE_DESCRIPTION: string = cfg.description;
export const CONTACT = { email: (cfg.contact as string) || "", note: (cfg.contactNote as string) || "" };
export const BYLINE = `${brand.name} Desk`;
export const DISCLOSURE: string = ((cfg.brand as { aiDisclosure?: string }).aiDisclosure || "").trim();

export const LEGAL = {
  siteUrl: ((cfg as { siteUrl?: string }).siteUrl || "").trim(),
  effectiveDate: ((cfg as { legalEffectiveDate?: string }).legalEffectiveDate || "").trim(),
  governingLaw: ((cfg as { governingLaw?: string }).governingLaw || "").trim(),
  controllerName: ((cfg as { controllerName?: string }).controllerName || "").trim(),
  mailboxProvider: ((cfg as { mailboxProvider?: string }).mailboxProvider || "").trim(),
  complaintOwner: ((cfg as { complaintOwner?: string }).complaintOwner || "").trim(),
};

export function legalEffectiveLabel(): string {
  const d = LEGAL.effectiveDate;
  if (!d) return "";
  const t = Date.parse(d.includes("T") ? d : `${d}T00:00:00Z`);
  if (!Number.isFinite(t)) return d;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
