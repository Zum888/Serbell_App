import { cn } from "@/lib/utils";

const styles = {
  loading: "border-slate-200 bg-white text-slate-600",
  empty: "border-slate-200 bg-white text-slate-600",
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StateView({
  variant,
  title,
  description,
  testId,
}: {
  variant: "loading" | "empty" | "error" | "success";
  title: string;
  description?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      data-variant={variant}
      role={variant === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-4 py-3 text-sm", styles[variant])}
    >
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
    </div>
  );
}
