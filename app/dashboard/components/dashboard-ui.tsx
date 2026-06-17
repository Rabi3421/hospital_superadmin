import { type LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-[#151918] sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm font-medium text-[#7a8581]">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "teal" | "red" | "amber" | "blue";
}) {
  const tones = {
    teal: "bg-[#edf8f3] text-[#278b7c]",
    red: "bg-red-50 text-red-700",
    amber: "bg-[#fff6df] text-[#a87918]",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="rounded-lg border border-[#e2eae6] bg-white p-4 shadow-[0_12px_32px_rgba(32,45,39,0.04)] sm:p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}><Icon size={17} /></span>
        <p className="text-xs font-bold text-[#687370] sm:text-sm">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#151918] sm:mt-4 sm:text-3xl">{value}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#edf8f3] text-[#278b7c]"><Icon size={22} /></span>
      <h3 className="mt-4 text-base font-bold text-[#151918]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-[#8a9591]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const style =
    ["active", "paid", "published", "live", "confirmed", "replied"].includes(normalized)
      ? "bg-[#e2f6f1] text-[#278b7c]"
      : ["blocked", "failed", "cancelled", "suspended", "overdue", "emergency"].includes(normalized)
        ? "bg-[#fdeae5] text-[#b95f45]"
        : ["trial", "pending", "new", "coming soon", "draft", "holiday"].includes(normalized)
          ? "bg-[#fff2d6] text-[#a87918]"
          : "bg-[#eef2f0] text-[#687370]";

  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${style}`}>{value}</span>;
}
