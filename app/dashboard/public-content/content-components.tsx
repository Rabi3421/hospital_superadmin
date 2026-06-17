import { Files } from "lucide-react";
import { EmptyState, PageHeader, StatusBadge } from "../components/dashboard-ui";
import ContentNav from "./content-nav";

export function ContentShell({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description ?? "Manage tenant public website content from the central platform."} action={action} />
      <ContentNav />
      {children}
    </div>
  );
}

export function ContentTable({ headers, rows, statusIndex }: { headers: string[]; rows: Array<Array<string | number>>; statusIndex?: number }) {
  return (
    <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
      {rows.length ? (
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]"><tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#edf2ef]">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-[#fbfdfc]">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-4 font-semibold text-[#394340]">{cellIndex === statusIndex ? <StatusBadge value={String(cell)} /> : cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <EmptyState icon={Files} title="No content found" description="Content created for hospital public websites will appear here." />}
    </section>
  );
}
