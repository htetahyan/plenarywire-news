import { CONTACT } from "@/lib/config";

/** Renders the public contact email from config, or a coming-soon line when empty. Never invents an address. */
export default function ContactLine({ forWhat }: { forWhat?: string }) {
  const purpose = forWhat ? ` for ${forWhat}` : "";
  if (CONTACT.email) {
    return <p>Email{purpose}: <a className="mono" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>{CONTACT.note ? <> — {CONTACT.note}</> : null}</p>;
  }
  return <p>Contact address{purpose}: coming soon.{CONTACT.note ? ` ${CONTACT.note}` : ""}</p>;
}
