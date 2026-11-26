import { ProgressBar } from "@/ui/progress-bar";

export type BlockProgressProps = { current: number; total: number };

/** Progress through the sections a person will see, which depends on their answers. */
export function BlockProgress({ current, total }: BlockProgressProps) {
  return (
    <div className="grid gap-2">
      <p className="text-label-sm text-text-sub-600">
        Section {current} of {total}
      </p>
      <ProgressBar value={current} max={total} label="Survey progress" />
    </div>
  );
}
