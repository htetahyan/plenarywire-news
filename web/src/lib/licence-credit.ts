/** Per-article text-licence credits from the cleared source register. */

export type SourceLicence = {
  sourceId: string;
  licenceUrl: string | null;
  licenceNote: string | null;
  publisher: string;
  mode: string;
};

const OGL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export function isOfficialSource(s: SourceLicence | null | undefined): boolean {
  if (!s) return true; // legacy articles without join: assume official until known otherwise
  return s.mode !== "facts-only";
}

/** Short label for the source list chip. */
export function sourceTypeLabel(s: SourceLicence | null | undefined): string {
  return isOfficialSource(s) ? "Official source" : "Source";
}

/** Article label stored in DB / kicker. */
export function articleLabelForMode(mode: string): string {
  return mode === "facts-only" ? "Reporting credit" : "Official source";
}

/** Human-readable rights line for the article Source box. */
export function textLicenceCredit(s: SourceLicence | null | undefined): { html: boolean; text: string; href?: string } | null {
  if (!s) return null;
  const id = s.sourceId;
  const note = (s.licenceNote || "").toLowerCase();
  if (id.startsWith("uk-") || /open government licence|ogl/i.test(note)) {
    return {
      html: true,
      text: "Contains public sector information licensed under the Open Government Licence v3.0.",
      href: s.licenceUrl || OGL,
    };
  }
  if (/cc by|creative commons|decision 2011\/833/i.test(note) || id.startsWith("ec-") || id === "eu-digital" || id === "ecb-press") {
    return {
      html: true,
      text: `Material from ${s.publisher} is reused under its stated Creative Commons / Commission reuse terms. Credits retain the supplied creator and notices where provided; changes are identified on the page. Reuse does not imply official endorsement.`,
      href: s.licenceUrl || CC_BY,
    };
  }
  if (/public domain|17 u\.?s\.?c|u\.?s\.? gov/i.test(note) || /^(whitehouse|dod|doj|fr-|fed-|ftc-|nist-|nasa-)/i.test(id)) {
    return {
      html: false,
      text: "Identified as a US federal government work: generally not protected by copyright under US law when created by a federal officer or employee as part of official duties, subject to exceptions. Protection may differ outside the United States. Individual credits apply; seals and logos are not licensed for PlenaryWire branding.",
      href: s.licenceUrl || undefined,
    };
  }
  if (s.mode === "facts-only") {
    return {
      html: false,
      text: "This outlet is used as a lead only. We do not adapt its wording, headlines or structure. Third-party material remains subject to its own licence.",
      href: s.licenceUrl || undefined,
    };
  }
  if (s.licenceNote) return { html: false, text: s.licenceNote, href: s.licenceUrl || undefined };
  return null;
}
