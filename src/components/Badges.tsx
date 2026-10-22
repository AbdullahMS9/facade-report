import { STATUS_LABEL } from "@/lib/schemas/project";

const STATUS_STYLE = {
  draft: "bg-neutral-100 text-neutral-800",
  ready: "bg-blue-100 text-blue-900",
  filed: "bg-green-100 text-green-900",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_STYLE }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

// "Due in 12 days" / "Due today" / "3 days overdue"
export function DaysLeft({ days }: { days: number }) {
  const tone = days < 0 ? "text-red-700" : days <= 14 ? "text-amber-700" : "text-neutral-700 dark:text-neutral-300";
  const text =
    days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`;
  return <span className={`text-sm font-medium ${tone}`}>{text}</span>;
}
