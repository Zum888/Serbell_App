import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
