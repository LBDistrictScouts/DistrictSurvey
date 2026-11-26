import * as AlignProgress from "@/components/ui/progress-bar";

export type ProgressBarProps = { value: number; max: number; label: string };

/** Progress as a labelled progressbar, coloured with the brand focus purple. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${label}: ${value} of ${max}`}>
      {/* AlignUI marks its inner bar as a progressbar too. The labelled one above is the one announced. */}
      <AlignProgress.Root aria-hidden value={(value / max) * 100} className="h-2 bg-bg-soft-200 [&>div]:bg-primary-base" />
    </div>
  );
}
