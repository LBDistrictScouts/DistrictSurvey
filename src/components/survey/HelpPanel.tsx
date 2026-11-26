import type { SiteSettings } from "@/lib/config/site";

export type HelpPanelProps = { text: string; helpContact: SiteSettings["helpContact"] };

/** The help message beside every comment box, in the reserved black on yellow style. */
export function HelpPanel({ text, helpContact }: HelpPanelProps) {
  return (
    <aside aria-label="Getting help" className="rounded-card bg-brand-help-background p-4 text-paragraph-md text-brand-help-text">
      <p className="font-bold">{text}</p>
      <p className="mt-2">{helpContact.text}</p>
      {helpContact.email || helpContact.phone ? (
        <p className="mt-2">
          {helpContact.email ? (
            <a className="font-bold text-brand-help-text" href={`mailto:${helpContact.email}`}>
              {helpContact.email}
            </a>
          ) : null}
          {helpContact.email && helpContact.phone ? " or " : null}
          {helpContact.phone ? <a className="font-bold text-brand-help-text" href={`tel:${helpContact.phone.replace(/\s+/g, "")}`}>{helpContact.phone}</a> : null}
        </p>
      ) : null}
    </aside>
  );
}
