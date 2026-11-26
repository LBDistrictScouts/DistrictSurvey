import type { Metadata } from "next";
import { OpenSurvey } from "@/components/survey/OpenSurvey";
import { readBuildData } from "@/lib/config/build-data";
import { siteSettings, turnstileSiteKey } from "@/lib/config/site";

export const metadata: Metadata = { title: "Survey" };

const data = readBuildData();

export default function SurveyPage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-title-h4">{data.compiled.title}</h1>
      <OpenSurvey survey={data.compiled} settings={siteSettings(data)} turnstileSiteKey={turnstileSiteKey()} />
    </div>
  );
}
