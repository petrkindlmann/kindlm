interface BadgeProps {
  status: "passed" | "failed" | "running";
  label?: string;
}

const config = {
  passed: {
    bg: "bg-green-50",
    text: "text-green-700",
    ring: "ring-green-200",
    dot: "bg-green-500",
    defaultLabel: "Passed",
  },
  failed: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    dot: "bg-red-500",
    defaultLabel: "Failed",
  },
  running: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    defaultLabel: "Running",
  },
} as const;

export default function Badge({ status, label }: BadgeProps) {
  const c = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${c.bg} ${c.text} ${c.ring}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${c.dot} ${
          status === "running" ? "animate-pulse" : ""
        }`}
      />
      {label ?? c.defaultLabel}
    </span>
  );
}
