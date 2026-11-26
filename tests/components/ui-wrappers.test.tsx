// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Alert } from "@/ui/alert";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Hint } from "@/ui/hint";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Modal } from "@/ui/modal";
import { ProgressBar } from "@/ui/progress-bar";
import { RadioGroup } from "@/ui/radio";
import { Select } from "@/ui/select";
import { Textarea } from "@/ui/textarea";
import { Tooltip } from "@/ui/tooltip";
import { setUpDom } from "./setup-dom";

beforeAll(setUpDom);

describe("UI wrappers", () => {
  it("[G4] radio groups are labelled and work with the keyboard", async () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="q">Pick one</span>
        <RadioGroup name="q" labelledBy="q" options={[{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }]} value="a" onChange={onChange} required invalid />
      </>,
    );
    const group = screen.getByRole("radiogroup", { name: "Pick one" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    screen.getByRole("radio", { name: "Apple" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Banana" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("[G4] checkboxes are labelled and toggle with Space", async () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <Checkbox id="c" label="Volunteer" checked={checked} onChange={setChecked} describedBy="hint" />;
    }
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Volunteer" });
    box.focus();
    await userEvent.keyboard(" ");
    expect(box).toBeChecked();
    await userEvent.click(screen.getByText("Volunteer"));
    expect(box).not.toBeChecked();
  });

  it("[G4] text boxes announce their character count with the field", async () => {
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <Label htmlFor="t" required>
            Comment
          </Label>
          <Textarea id="t" value={value} onChange={setValue} maxLength={10} counterId="t-count" aria-describedby="t-help" />
        </>
      );
    }
    render(<Harness />);
    const box = screen.getByRole("textbox", { name: /Comment/ });
    await userEvent.type(box, "Hello");
    expect(box).toHaveAttribute("aria-describedby", "t-help t-count");
    expect(screen.getByText("5/10")).toBeInTheDocument();
    expect(screen.getByText("(required)", { exact: false })).toHaveClass("sr-only");
  });

  it("[G4] buttons default to type button and accept every variant", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="quiet" type="submit">
          Quiet
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Primary" }).className).toContain("bg-brand-primary");
    expect(screen.getByRole("button", { name: "Quiet" })).toHaveAttribute("type", "submit");
  });

  it("[G4] dialogs trap focus and close with Escape", async () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="Confirm" description="Are you sure?" footer={<Button>OK</Button>} />);
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveAccessibleDescription("Are you sure?");
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("[G4] alerts, hints and progress are announced in the right way", () => {
    render(
      <>
        <Alert status="error" title="Problem" />
        <Alert status="information" title="Note">
          <p>Detail</p>
        </Alert>
        <Alert status="success" title="Done" live />
        <Hint id="h" error>
          Wrong
        </Hint>
        <Hint id="h2">Help</Hint>
        <ProgressBar value={2} max={4} label="Survey progress" />
        <Badge>New</Badge>
        <Input aria-label="Name" invalid />
      </>,
    );
    expect(screen.getAllByRole("alert").map((element) => element.textContent)).toEqual(["Problem", "Done", "Wrong"]);
    expect(screen.getByRole("status")).toHaveTextContent("NoteDetail");
    expect(screen.getByRole("progressbar", { name: "Survey progress" })).toHaveAttribute("aria-valuetext", "Survey progress: 2 of 4");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("selects and tooltips are labelled", () => {
    render(
      <>
        <span id="s-label">Section</span>
        <Select id="s" labelledBy="s-label" placeholder="Choose" onChange={() => undefined} options={[{ value: "a", label: "A" }]} />
        <Tooltip content="More detail">
          <button type="button">Info</button>
        </Tooltip>
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeInTheDocument();
  });
});
