// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyRunner, type SurveyRunnerProps } from "@/components/survey/SurveyRunner";
import { SubmissionMessage } from "@/components/survey/SubmissionMessage";
import { ReceiptPrompt } from "@/components/survey/ReceiptPrompt";
import { OptOut, optOutText } from "@/components/survey/OptOut";
import { ReopenLinkMessage } from "@/components/survey/ReopenLinkMessage";
import { HelpPanel } from "@/components/survey/HelpPanel";
import { draftKey, newDraft } from "@/lib/client/drafts";
import { exampleBuildData } from "@/lib/config/build-data";
import { siteSettings } from "@/lib/config/site";
import { errorCatalogue } from "@/lib/contracts/types";
import { setUpDom } from "./setup-dom";

const data = exampleBuildData();
const survey = data.compiled;
const settings = siteSettings(data);

beforeAll(setUpDom);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function renderRunner(submit: SurveyRunnerProps<unknown>["submit"] = vi.fn(async () => ({ ok: true as const, data: { status: "saved" } })), onSubmitted = vi.fn()) {
  const draft = newDraft(survey.surveyId, survey.fingerprint, "open");
  const onClear = vi.fn(() => newDraft(survey.surveyId, survey.fingerprint, "open"));
  render(<SurveyRunner survey={survey} settings={settings} draft={draft} submit={submit} onSubmitted={onSubmitted} onClear={onClear} />);
  return { submit, onSubmitted, onClear, user: userEvent.setup() };
}

const group = (name: RegExp) => screen.getByRole("group", { name });

describe("SurveyRunner", () => {
  it("[G3] saves each answer in the browser as it is given, and sends nothing until submit", async () => {
    const { submit, user } = renderRunner();
    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByLabelText("Scout Network member"));

    expect(JSON.parse(localStorage.getItem(draftKey(survey.surveyId, "open"))!).answers).toEqual({ "age-group": "adult", "adult-roles": ["network"] });
    expect(submit).not.toHaveBeenCalled();
  });

  it("[G1] shows the next section for the answers given, and explains missing answers", async () => {
    const { user } = renderRunner();
    await user.click(screen.getByRole("button", { name: "Send my answers" }));
    expect(screen.getByText("There is a problem with 1 answer")).toBeInTheDocument();
    expect(screen.getByText("Answer this question to continue.")).toBeInTheDocument();

    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm in a Scout section"));
    await user.click(within(group(/Which section are you in/)).getByLabelText("Beavers"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Your section" })).toHaveFocus();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Section 2 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();
  });

  it("[G3] warns before removing answers that no longer apply, and keeps them if the person cancels", async () => {
    const { user } = renderRunner();
    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByLabelText("Parent or carer"));
    await user.click(within(group(/sections are your children in/)).getByLabelText("Cubs"));

    await user.click(screen.getByLabelText("Parent or carer"));
    const dialog = await screen.findByRole("dialog", { name: "Change this answer?" });
    expect(dialog).toHaveTextContent("1 answer you gave no longer applies");
    await user.click(within(dialog).getByRole("button", { name: "Keep my answer" }));
    expect(screen.getByLabelText("Parent or carer")).toBeChecked();

    await user.click(screen.getByLabelText("Parent or carer"));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Change it" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: /sections are your children in/ })).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(draftKey(survey.surveyId, "open"))!).answers).toEqual({ "age-group": "adult" });
  });

  it("submits the answers once they are complete, and reports success", async () => {
    const { submit, onSubmitted, user } = renderRunner();
    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByLabelText("Scout Network member"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(group(/Network activities/)).getByLabelText("Rarely"));
    await user.type(screen.getByRole("textbox"), "Thank you");
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ answers: { "age-group": "adult", "adult-roles": ["network"], "network-activities": "rarely", "adult-comments": "Thank you" } }));
    expect(onSubmitted).toHaveBeenCalled();
  });

  it("shows each error code's message, and highlights answers the server rejected", async () => {
    const submit = vi.fn(async () => ({ ok: false as const, code: "invalid_answers" as const, questionIds: ["age-group"] }));
    const { user } = renderRunner(submit);
    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByLabelText("Scout Network member"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(within(group(/Network activities/)).getByLabelText("Rarely"));
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(await screen.findByText(errorCatalogue.invalid_answers.message)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About you" })).toBeInTheDocument();
    expect(screen.getByText("This answer could not be accepted. Check it and try again.")).toBeInTheDocument();
  });

  it("[G3] clears the answers after confirming", async () => {
    const { onClear, user } = renderRunner();
    await user.click(within(group(/Which best describes you/)).getByLabelText("I'm an adult"));
    await user.click(screen.getByRole("button", { name: "Clear my answers" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Clear answers" }));
    expect(onClear).toHaveBeenCalled();
    expect(within(group(/Which best describes you/)).getByLabelText("I'm an adult")).not.toBeChecked();
  });
});

describe("survey messages", () => {
  it.each(Object.keys(errorCatalogue) as (keyof typeof errorCatalogue)[])("shows the message and action for %s", (code) => {
    render(<SubmissionMessage code={code} />);
    expect(screen.getByRole("alert")).toHaveTextContent(errorCatalogue[code].message);
    expect(screen.getByRole("alert")).toHaveTextContent(errorCatalogue[code].action);
  });

  it("[G8] the receipt prompt offers both answers", async () => {
    const yes = vi.fn();
    const no = vi.fn();
    render(<ReceiptPrompt onAlreadyResponded={yes} onNotResponded={no} />);
    await userEvent.click(screen.getByRole("button", { name: "Yes, that was me" }));
    await userEvent.click(screen.getByRole("button", { name: "No, I haven't answered yet" }));
    expect([yes.mock.calls.length, no.mock.calls.length]).toEqual([1, 1]);
  });

  it("the opt-out asks for confirmation, and stays open if declining fails", async () => {
    const decline = vi.fn(async () => false);
    render(<OptOut onDecline={decline} />);
    await userEvent.click(screen.getByRole("button", { name: optOutText }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Stop reminders" }));
    expect(decline).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("the reopen message mentions saved answers only when there are some", () => {
    const { rerender } = render(<ReopenLinkMessage hasDraft={false} />);
    expect(screen.queryByText(/saved on this device/)).not.toBeInTheDocument();
    rerender(<ReopenLinkMessage hasDraft />);
    expect(screen.getByText(/saved on this device/)).toBeInTheDocument();
  });

  it("[G15] the help panel shows every contact route", () => {
    render(<HelpPanel text="Comments are not read straight away." helpContact={{ text: "Talk to us.", email: "help@example.org", phone: "01234 567890" }} />);
    expect(screen.getByRole("link", { name: "help@example.org" })).toHaveAttribute("href", "mailto:help@example.org");
    expect(screen.getByRole("link", { name: "01234 567890" })).toHaveAttribute("href", "tel:01234567890");
  });
});
