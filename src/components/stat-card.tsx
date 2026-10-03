import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statCardVariants = cva(
  "rounded-xl border bg-white dark:bg-card shadow-sm p-6 flex flex-col gap-2 transition-all hover:shadow-md",
  {
    variants: {
      accent: {
        blue: "border-l-4 border-l-blue-500",
        green: "border-l-4 border-l-emerald-500",
        red: "border-l-4 border-l-red-500",
        amber: "border-l-4 border-l-amber-500",
        violet: "border-l-4 border-l-violet-500",
        primary: "border-l-4 border-l-primary",
      },
    },
    defaultVariants: { accent: "blue" },
  }
);

interface StatCardProps extends VariantProps<typeof statCardVariants> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  className,
  loading,
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ accent }), className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="text-muted-foreground/60">{icon}</div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      )}
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}