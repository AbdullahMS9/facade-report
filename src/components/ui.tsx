import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// Small, mobile-first building blocks. Tap targets are at least 48px tall.

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-400",
    secondary:
      "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:bg-neutral-900",
  }[variant];
  return (
    <button
      className={`min-h-12 rounded-lg px-4 text-base font-medium disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="min-h-12 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        {...props}
      />
      {hint ? <span className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export function Message({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-green-300 bg-green-50 text-green-800",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}
