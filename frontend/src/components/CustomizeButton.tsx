"use client";

type Props = {
  disabled: boolean;
  disabledReason?: string;
  loading?: boolean;
  onClick?: () => void;
};

export function CustomizeButton({ disabled, disabledReason, loading, onClick }: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={!loading && disabled ? disabledReason : undefined}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:w-auto ${
        isDisabled
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
          : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      }`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {loading ? "Customizing…" : "Customize"}
    </button>
  );
}
