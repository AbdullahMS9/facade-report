// Plain link (not next/link): the response is a file download, not a page.
export function ReportButton({ projectId, blockers }: { projectId: string; blockers: number }) {
  return (
    <div className="flex flex-col gap-1">
      <a
        href={`/projects/${projectId}/report`}
        download
        className="flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-4 font-medium dark:border-neutral-600"
      >
        Download report (.docx)
      </a>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {blockers > 0
          ? `Marked DRAFT until the ${blockers} checker blocker${blockers === 1 ? " is" : "s are"} fixed. Sections without data are highlighted for the QEWI.`
          : "Sections without data are highlighted for the QEWI to complete."}
      </span>
    </div>
  );
}
