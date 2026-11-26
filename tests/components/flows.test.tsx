// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteSurvey } from "@/components/survey/InviteSurvey";
import { OpenSurvey } from "@/components/survey/OpenSurvey";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { draftKey, newDraft, saveDraft } from "@/lib/client/drafts";
import { forgetInviteToken } from "@/lib/client/invite-link";
import { saveReceipt } from "@/lib/client/receipts";
import { exampleBuildData } from "@/lib/config/build-data";
import { siteSettings } from "@/lib/config/site";
import { setUpDom } from "./setup-dom";

const data = exampleBuildData();
const survey = data.compiled;
const settings = siteSettings(data);
const token = `eyJ2IjoxfQ.${"A".repeat(43)}`;

type Call = { path: string; body: Record<string, unknown> };
let calls: Call[] = [];
let replies: Record<string, (body: Record<string, unknown>) => [number, object]> = {};

beforeAll(setUpDom);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  forgetInviteToken();
  calls = [];
  replies = {};
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-14T12:00:00Z"));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const path = new URL(url, "http://localhost").pathname;
    const body = JSON.parse(String(init.body));
    calls.push({ path, body });
    const [status, reply] = (replies[path] ?? (() => [200, { status: "ok" }]))(body);
    return new Response(JSON.stringify(reply), { status });
  });
  window.turnstile = {
    render: (_container: HTMLElement, options: Record<string, unknown>) => {
      (window as unknown as { options: typeof options }).options = options;
      return "widget";
    },
    reset: () => undefined,
    execute: () => setTimeout(() => ((window as unknown as { options: { callback: (token: string) => void } }).options.callback("turnstile-token")), 0),
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const group = (name: RegExp) => screen.getByRole("group", { name });

describe("OpenSurvey", () => {
  it("[G8] sends the answers with a Turnstile token and keeps the receipt", async () => {
    replies["/api/v1/responses/open"] = () => [200, { status: "saved", receipt: "r.e", receiptExpiresAt: "2027-03-31T23:59:00Z" }];
    const user = userEvent.setup();
    render(<OpenSurvey survey={survey} settings={settings} turnstileSiteKey="key" />);

    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByLabelText("Scout Network member"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(group(/Network activities/)).getByLabelText("Monthly or more"));
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(await screen.findByText("Thank you, your answers have been received")).toBeInTheDocument();
    expect(calls[0]!.body).toMatchObject({ surveyId: survey.surveyId, turnstileToken: "turnstile-token", answers: { "network-activities": "monthly" } });
    expect(JSON.parse(localStorage.getItem("district-survey:example-2027:receipt")!).receipt).toBe("r.e");
    expect(localStorage.getItem(draftKey(survey.surveyId, "open"))).toBeNull();
  });

  it("[G21] says when the survey opens and when it has closed, and tells the person when old answers were removed", async () => {
    vi.setSystemTime(new Date("2027-02-01T12:00:00Z"));
    const { unmount } = render(<OpenSurvey survey={survey} settings={settings} turnstileSiteKey="key" />);
    expect(await screen.findByText("The survey opens on 1 March 2027")).toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date("2027-04-02T12:00:00Z"));
    const closed = render(<OpenSurvey survey={survey} settings={settings} turnstileSiteKey="key" />);
    expect(await screen.findByText("This survey has closed")).toBeInTheDocument();
    closed.unmount();

    vi.setSystemTime(new Date("2027-03-14T12:00:00Z"));
    saveDraft(newDraft(survey.surveyId, `sha256:${"9".repeat(64)}`, "open"), false);
    render(<OpenSurvey survey={survey} settings={settings} turnstileSiteKey="key" />);
    expect(await screen.findByText(/The survey has changed since you started/)).toBeInTheDocument();
  });
});

describe("InviteSurvey", () => {
  function open(hash = `#invite=${token}`) {
    window.location.hash = hash;
    return render(<InviteSurvey survey={survey} settings={settings} />);
  }

  it("[G5] starts, saves the answers, completes the link and offers the results", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    replies["/api/v1/responses/tracked"] = () => [200, { status: "saved" }];
    replies["/api/v1/tracking/complete"] = () => [200, { status: "completed", resultsToken: "results.token" }];
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("button", { name: "Start the survey" }));
    expect(window.location.hash).toBe("");
    expect(screen.getByLabelText("Volunteer")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(group(/keep you informed/)).getByLabelText("4"));
    await user.click(within(group(/How supported/)).getByLabelText("3"));
    await user.click(within(group(/hours a week/)).getByLabelText("Under 2"));
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(await screen.findByRole("link", { name: "See the results so far" })).toHaveAttribute("href", "https://results.example.org/access#token=results.token");
    expect(calls.map((call) => call.path)).toEqual(["/api/v1/tracking/open", "/api/v1/tracking/start", "/api/v1/responses/tracked", "/api/v1/tracking/complete"]);
    expect(calls[2]!.body).toMatchObject({ trackedPass: "pass", retrySecretHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(JSON.stringify(calls[2]!.body)).not.toContain(token);
  });

  it("[G8] claims an open-link receipt after the person confirms", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    replies["/api/v1/tracking/claim"] = () => [200, { status: "completed", resultsToken: "results.token" }];
    saveReceipt(survey.surveyId, "receipt.value", "2027-03-31T23:59:00Z");
    open();

    await userEvent.click(await screen.findByRole("button", { name: "Yes, that was me" }));
    expect(await screen.findByText("Thank you for taking part")).toBeInTheDocument();
    expect(calls[1]).toEqual({ path: "/api/v1/tracking/claim", body: { token, receipt: "receipt.value" } });
    expect(localStorage.getItem("district-survey:example-2027:receipt")).toBeNull();
  });

  it("[G8] shows why a claim failed, and starts normally when the person has not responded", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    replies["/api/v1/tracking/claim"] = () => [409, { error: "already_completed" }];
    saveReceipt(survey.surveyId, "receipt.value", "2027-03-31T23:59:00Z");
    open();

    await userEvent.click(await screen.findByRole("button", { name: "Yes, that was me" }));
    expect(await screen.findByText("A response has already been received for this invitation.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "No, I haven't answered yet" }));
    expect(screen.getByRole("button", { name: "Start the survey" })).toBeInTheDocument();
  });

  it("opts out of reminders, and says so when the link is opened again", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    const { unmount } = open();
    await userEvent.click(await screen.findByRole("button", { name: /suppress any further reminders/ }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Stop reminders" }));
    expect(await screen.findByText("We won't send you any more reminders")).toBeInTheDocument();
    unmount();

    forgetInviteToken();
    open();
    expect(await screen.findByText("You asked us to stop reminders for this survey")).toBeInTheDocument();
  });

  it("shows a failed decline without leaving the page", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    replies["/api/v1/tracking/decline"] = () => [409, { error: "survey_closed" }];
    open();
    await userEvent.click(await screen.findByRole("button", { name: /suppress any further reminders/ }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Stop reminders" }));
    expect(await screen.findByText("This survey has closed, so we can't accept new answers.")).toBeInTheDocument();
  });

  it("[G5] a completed link shows the results straight away, and errors show their message", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "completed", resultsToken: "results.token" }];
    const { unmount } = open();
    expect(await screen.findByText("Thank you for taking part")).toBeInTheDocument();
    unmount();

    forgetInviteToken();
    replies["/api/v1/tracking/open"] = () => [400, { error: "invalid_link" }];
    open();
    expect(await screen.findByText("This invitation link isn't valid.")).toBeInTheDocument();
  });

  it("[G3] without a link in memory, asks the person to reopen it", async () => {
    saveDraft(newDraft(survey.surveyId, survey.fingerprint, "tracked"), false);
    open("");
    expect(await screen.findByText("Please open your invitation link again")).toBeInTheDocument();
    expect(screen.getByText("Your answers so far are saved on this device.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("[G5] keeps the answers when completing fails, and says what to do", async () => {
    replies["/api/v1/tracking/open"] = () => [200, { status: "ready", trackedPass: "pass", closesAt: "2027-03-31T22:59:00Z" }];
    replies["/api/v1/responses/tracked"] = () => [200, { status: "saved" }];
    replies["/api/v1/tracking/complete"] = () => [400, { error: "invalid_link" }];
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Start the survey" }));
    await user.click(screen.getByRole("button", { name: "Clear my answers" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear answers" }));
    expect(screen.getByLabelText("Volunteer")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(group(/keep you informed/)).getByLabelText("4"));
    await user.click(within(group(/How supported/)).getByLabelText("3"));
    await user.click(within(group(/hours a week/)).getByLabelText("Under 2"));
    await user.click(screen.getByRole("button", { name: "Send my answers" }));
    expect(await screen.findByText("This invitation link isn't valid.")).toBeInTheDocument();
  });
});

describe("theme", () => {
  it("[G4] the switch sets the theme and shows which is chosen", async () => {
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await act(async () => undefined);
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("district-survey:theme")).toBe("dark");
  });
});
