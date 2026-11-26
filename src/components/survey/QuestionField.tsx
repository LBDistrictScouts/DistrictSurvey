"use client";

import type { AnswerOption, AnswerValue, Question } from "@lbdistrictscouts/survey-engine";
import { Checkbox } from "@/ui/checkbox";
import { Hint } from "@/ui/hint";
import { Label } from "@/ui/label";
import { RadioGroup } from "@/ui/radio";
import { Textarea } from "@/ui/textarea";

export type QuestionFieldProps = {
  question: Question;
  options: AnswerOption[];
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  error?: string;
};

export const errorMessages: Record<string, string> = {
  required: "Answer this question to continue.",
  invalid_option: "Choose one of the answers shown.",
  invalid_value: "Choose one of the answers shown.",
  too_long: "Your answer is too long. Shorten it to continue.",
  unknown_question: "This question is no longer in the survey.",
  rejected: "This answer could not be accepted. Check it and try again.",
};

/** One question: single and multiple choice, a scale, or a written answer. */
export function QuestionField({ question, options, value, onChange, error }: QuestionFieldProps) {
  const headingId = `${question.id}-question`;
  const helpId = question.help ? `${question.id}-help` : undefined;
  const errorId = error ? `${question.id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const optional = question.required ? null : <span className="text-text-sub-600"> (optional)</span>;

  const help = question.help ? (
    <p id={helpId} className="text-paragraph-md text-text-sub-600">
      {question.help}
    </p>
  ) : null;
  const errorHint = error ? (
    <Hint id={errorId!} error>
      {error}
    </Hint>
  ) : null;

  if (question.type === "text") {
    return (
      <div className="grid gap-2" data-question={question.id}>
        <Label htmlFor={question.id} id={headingId} required={question.required}>
          {question.text}
          {optional}
        </Label>
        {help}
        {errorHint}
        <Textarea id={question.id} value={typeof value === "string" ? value : ""} onChange={(text) => onChange(text === "" ? undefined : text)} maxLength={question.maxLength} invalid={Boolean(error)} counterId={`${question.id}-count`} aria-describedby={describedBy} />
      </div>
    );
  }

  const legend = (
    <legend id={headingId} className="mb-2 text-label-md text-text-strong-950">
      {question.text}
      {optional}
      {question.required ? <span className="sr-only"> (required)</span> : null}
    </legend>
  );

  if (question.type === "multiple") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-2" data-question={question.id} aria-describedby={describedBy}>
        {legend}
        <p className="text-paragraph-sm text-text-sub-600">Choose all that apply.</p>
        {help}
        {errorHint}
        {options.map((option) => (
          <Checkbox
            key={option.id}
            id={`${question.id}-${option.id}`}
            label={option.text}
            checked={selected.includes(option.id)}
            onChange={(checked) => {
              const next = checked ? [...selected, option.id] : selected.filter((id) => id !== option.id);
              // Keep the order of the options, so the stored answer does not depend on click order.
              const ordered = options.map((item) => item.id).filter((id) => next.includes(id));
              onChange(ordered.length > 0 ? ordered : undefined);
            }}
          />
        ))}
      </fieldset>
    );
  }

  const choices =
    question.type === "scale"
      ? Array.from({ length: question.max - question.min + 1 }, (_, index) => {
          const point = question.min + index;
          const label = point === question.min ? `${point}: ${question.minLabel}` : point === question.max ? `${point}: ${question.maxLabel}` : String(point);
          return { value: String(point), label };
        })
      : options.map((option) => ({ value: option.id, label: option.text }));

  return (
    <fieldset className="grid gap-2" data-question={question.id} aria-describedby={describedBy}>
      {legend}
      {help}
      {errorHint}
      <RadioGroup
        name={question.id}
        options={choices}
        value={value === undefined ? undefined : String(value)}
        onChange={(chosen) => onChange(question.type === "scale" ? Number(chosen) : chosen)}
        labelledBy={headingId}
        describedBy={describedBy}
        required={question.required}
        invalid={Boolean(error)}
      />
    </fieldset>
  );
}
