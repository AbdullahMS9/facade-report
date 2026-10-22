import type { ReactNode } from "react";

// Two-step delete without JavaScript: open the panel, then confirm.
export function ConfirmDelete({
  action,
  label,
  warning,
  hidden,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  warning: ReactNode;
  hidden?: Record<string, string>;
}) {
  return (
    <details className="rounded-lg border border-red-200 px-3">
      <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-red-700">{label}</summary>
      <form action={action} className="flex flex-col gap-3 pb-3">
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <p className="text-sm">{warning}</p>
        <button type="submit" className="min-h-12 rounded-lg bg-red-700 px-4 font-medium text-white hover:bg-red-800">
          Yes, delete
        </button>
      </form>
    </details>
  );
}
