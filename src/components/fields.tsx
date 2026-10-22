import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Extra form controls that match Field in ui.tsx.

const control =
  "min-h-12 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100";

// Labels point at their control by id (not by wrapping it), so the accessible
// name is just the label, not the label plus the selected option.
function Labelled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint ? <span id={`${id}-hint`} className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</span> : null}
    </div>
  );
}

export function Select({
  label,
  hint,
  children,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; children: ReactNode }) {
  const fieldId = id ?? `f-${props.name}`;
  return (
    <Labelled id={fieldId} label={label} hint={hint}>
      <select id={fieldId} aria-describedby={hint ? `${fieldId}-hint` : undefined} className={control} {...props}>
        {children}
      </select>
    </Labelled>
  );
}

export function TextArea({
  label,
  hint,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const fieldId = id ?? `f-${props.name}`;
  return (
    <Labelled id={fieldId} label={label} hint={hint}>
      <textarea
        id={fieldId}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className={`${control} py-2`}
        rows={3}
        {...props}
      />
    </Labelled>
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
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <legend className="px-1 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
