"use client";

type Props = {
  disabled: boolean;
  disabledReason?: string;
  onClick?: () => void;
};

export function CustomizeButton({ disabled, disabledReason, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled}
      className={`w-full rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:w-auto ${
        disabled
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
          : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      }`}
    >
      Customize
    </button>
  );
}
