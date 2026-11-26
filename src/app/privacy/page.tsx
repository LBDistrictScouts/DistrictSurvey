import type { Metadata } from "next";
import { readBuildData } from "@/lib/config/build-data";
import { respondentPromise, technicalRecords, youngPeopleRecords } from "@/lib/config/privacy-text";

export const metadata: Metadata = { title: "Privacy notice" };

const { settings } = readBuildData();

export default function PrivacyPage() {
  return (
    <article className="grid gap-6">
      <h1 className="text-title-h4">Privacy notice</h1>

      <section aria-labelledby="answers-heading" className="grid gap-2">
        <h2 id="answers-heading" className="text-title-h6">
          Your answers
        </h2>
        <p className="text-paragraph-md" data-testid="respondent-promise">
          {respondentPromise}
        </p>
        <p className="text-paragraph-md">
          We never store your name, email address or IP address with your answers, and we store only the date you answered, not the time. Results are shown only for groups of at least 6 people.
        </p>
      </section>

      <section aria-labelledby="records-heading" className="grid gap-2">
        <h2 id="records-heading" className="text-title-h6">
          Technical records
        </h2>
        <p className="text-paragraph-md" data-testid="technical-records">
          {technicalRecords}
        </p>
      </section>

      <section aria-labelledby="young-heading" className="grid gap-2 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200">
        <h2 id="young-heading" className="text-title-h6">
          For young people
        </h2>
        <p className="text-paragraph-md">We won&apos;t ask for your name. Your answers are mixed with lots of other people&apos;s, so nobody can tell which answers are yours.</p>
        <p className="text-paragraph-md" data-testid="young-technical-records">
          {youngPeopleRecords}
        </p>
      </section>

      <section aria-labelledby="contact-heading" className="grid gap-2">
        <h2 id="contact-heading" className="text-title-h6">
          Questions about your data
        </h2>
        <p className="text-paragraph-md">
          Contact <a href={`mailto:${settings.privacyContact}`}>{settings.privacyContact}</a>.
        </p>
      </section>
    </article>
  );
}
