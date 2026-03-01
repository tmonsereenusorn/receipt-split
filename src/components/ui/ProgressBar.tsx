interface ProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const pct = Math.round(progress * 100);
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
