import { errorCatalogue, type ErrorCode } from "@/lib/contracts/types";
import { Alert } from "@/ui/alert";

export type SubmissionMessageProps = { code: ErrorCode };

/** Each error code's message and action, from the survey API contract. */
export function SubmissionMessage({ code }: SubmissionMessageProps) {
  const entry = errorCatalogue[code];
  return (
    <Alert status="error" title={entry.message}>
      <p>{entry.action}</p>
    </Alert>
  );
}
