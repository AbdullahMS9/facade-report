import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Extra form controls that match Field in ui.tsx.

const control =
  "min-h-12 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100";

export function Select({
  label,
  hint,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <select className={control} {...props}>
        {children}
      </select>
      {hint ? <span className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <textarea className={`${control} py-2`} rows={3} {...props} />
      {hint ? <span className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</span> : null}
    </label>
  );
}

// Yes / No / not answered, for questions like "Cavity wall?".
export function YesNoSelect({ label, name, value, hint }: { label: string; name: string; value: boolean | null; hint?: string }) {
  return (
    <Select label={label} name={name} defaultValue={value === null ? "" : value ? "yes" : "no"} hint={hint}>
      <option value="">Not answered</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </Select>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <legend className="px-1 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
