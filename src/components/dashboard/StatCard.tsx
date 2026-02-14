import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "gain" | "loss" | "neutral";
  icon?: React.ReactNode;
  delay?: number;
}

export function StatCard({ label, value, change, changeType = "neutral", icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className="rounded-xl border bg-card p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
      </div>
      {change && (
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            changeType === "gain" && "text-gain",
            changeType === "loss" && "text-loss",
            changeType === "neutral" && "text-muted-foreground"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
