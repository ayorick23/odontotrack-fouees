export const fieldInputClass =
  "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100";

export function fieldBorder(hasError: boolean): string {
  return hasError
    ? "border-red-400 focus:border-red-500 dark:border-red-500"
    : "border-slate-200 focus:border-[#2ad4c5] dark:border-slate-700";
}
