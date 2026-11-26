import { Alert } from "@/ui/alert";

/**
 * Shown when /invite has no link in memory, such as after a reload. The link is removed from the
 * address bar when the page opens, so the person reopens it from their email. Any saved answers are kept.
 */
export function ReopenLinkMessage({ hasDraft }: { hasDraft: boolean }) {
  return (
    <Alert status="information" title="Please open your invitation link again" live={false}>
      <p>For your privacy, this page doesn&apos;t keep your personal link. Open the link in your invitation email to carry on.</p>
      {hasDraft ? <p className="mt-2">Your answers so far are saved on this device.</p> : null}
    </Alert>
  );
}
