import type { Metadata } from "next";
import { InviteSurvey } from "@/components/survey/InviteSurvey";
import { readBuildData } from "@/lib/config/build-data";
import { siteSettings } from "@/lib/config/site";

export const metadata: Metadata = { title: "Your invitation" };

const data = readBuildData();

export default function InvitePage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-title-h4">{data.compiled.title}</h1>
      <InviteSurvey survey={data.compiled} settings={siteSettings(data)} />
    </div>
  );
}
