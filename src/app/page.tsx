import Link from "next/link";
import { readBuildData } from "@/lib/config/build-data";
import { formatDate } from "@/lib/config/site";

const { settings } = readBuildData();

export default function Home() {
  return (
    <div className="grid gap-6">
      <h1 className="text-title-h4">Tell us about your Scouting</h1>
      <p className="text-paragraph-lg">
        {settings.organisationName} wants to hear from young people, parents and carers, volunteers and Network members. The survey asks only the questions that apply to you, and takes about 10 minutes.
      </p>
      <p className="text-paragraph-md text-text-sub-600">
        Open from {formatDate(settings.opensAt)} to {formatDate(settings.closesAt)}.
      </p>

      <section aria-labelledby="privacy-heading" className="grid gap-2 rounded-card bg-bg-white-0 p-6 ring-1 ring-stroke-soft-200">
        <h2 id="privacy-heading" className="text-title-h6">
          Your answers
        </h2>
        <p className="text-paragraph-md">
          Your answers are stored separately from your invitation, and people reviewing results only see grouped results. A volunteer reviewer reads any written comments. Answers are kept by the district with no deletion date.
        </p>
        <p className="text-paragraph-md">
          <Link href="/privacy">Read the privacy notice</Link>
        </p>
      </section>

      <div className="grid gap-3">
        <Link href="/survey" className="inline-flex min-h-11 w-fit items-center rounded-10 bg-brand-primary px-5 text-label-md text-brand-on-primary no-underline">
          Start the survey
        </Link>
        <p className="text-paragraph-sm text-text-sub-600">If you&apos;re a volunteer with an email invitation, please use the link in your email instead.</p>
      </div>
    </div>
  );
}
