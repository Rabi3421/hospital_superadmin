"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, UsersRound, X } from "lucide-react";
import { EmptyState, StatusBadge } from "../components/dashboard-ui";

export type ReferralPartnerRow = {
  referralPartnerId: string;
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
  type: string;
  status: string;
  payoutNote?: string;
  notes?: string;
  hospitalCount: number;
};

export default function ReferralPartnerManager({ partners }: { partners: ReferralPartnerRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<ReferralPartnerRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => partners.filter((partner) => {
    const text = `${partner.name} ${partner.phone} ${partner.email} ${partner.organization} ${partner.referralPartnerId}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (!status || partner.status === status);
  }), [partners, query, status]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(editing ? `/api/superadmin/referral-partners/${editing.referralPartnerId}` : "/api/superadmin/referral-partners", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.message ?? "Unable to save referral partner");
      return;
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 md:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[#dfe8e4] px-3"><Search size={16} className="text-[#8a9591]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, contact, organization, or ID" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm font-semibold"><option value="">All statuses</option><option>Active</option><option>Inactive</option></select>
        <button onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white"><Plus size={16} />Add partner</button>
      </div>
      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white">
        {filtered.length ? <table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]"><tr><th className="px-5 py-4">Profile</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Hospitals</th><th className="px-5 py-4">Payout Note</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#edf2ef]">{filtered.map((partner) => <tr key={partner.referralPartnerId} className="hover:bg-[#fbfdfc]"><td className="px-5 py-4"><p className="font-bold text-[#151918]">{partner.name}</p><p className="mt-1 text-xs text-[#8a9591]">{partner.organization || partner.referralPartnerId}</p></td><td className="px-5 py-4 text-[#394340]">{partner.phone || "No phone"}<p className="mt-1 text-xs text-[#8a9591]">{partner.email || "No email"}</p></td><td className="px-5 py-4 font-semibold text-[#394340]">{partner.type}</td><td className="px-5 py-4 font-bold text-[#151918]">{partner.hospitalCount}</td><td className="max-w-[260px] px-5 py-4 text-xs text-[#687370]">{partner.payoutNote || "Not recorded"}</td><td className="px-5 py-4"><StatusBadge value={partner.status} /></td><td className="px-5 py-4 text-right"><button onClick={() => setEditing(partner)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] hover:bg-[#edf8f3]"><Pencil size={16} /></button></td></tr>)}</tbody></table> : <EmptyState icon={UsersRound} title="No referral partners found" description="Create a reusable profile for the people who introduce hospital clients." action={<button onClick={() => setCreating(true)} className="rounded-md bg-[#278b7c] px-4 py-2 text-sm font-bold text-white">Add partner</button>} />}
      </section>
      {(creating || editing) ? <PartnerDialog partner={editing} loading={loading} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={save} /> : null}
    </>
  );
}

function PartnerDialog({ partner, loading, error, onClose, onSubmit }: { partner: ReferralPartnerRow | null; loading: boolean; error: string; onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4" onMouseDown={onClose}><div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4"><div><h2 className="text-lg font-bold text-[#151918]">{partner ? "Edit referral partner" : "Add referral partner"}</h2><p className="mt-1 text-xs text-[#8a9591]">{partner?.referralPartnerId || "Reusable profile for hospital onboarding"}</p></div><button onClick={onClose}><X size={20} /></button></div><form onSubmit={onSubmit} className="grid gap-4 p-5 sm:grid-cols-2"><Field name="name" label="Full Name" defaultValue={partner?.name} required /><Select name="type" label="Profile Type" defaultValue={partner?.type ?? "Individual"} options={["Individual", "Employee", "Agency", "Partner"]} /><Field name="phone" label="Phone" defaultValue={partner?.phone} /><Field name="email" label="Email" type="email" defaultValue={partner?.email} /><Field name="organization" label="Organization / Company" defaultValue={partner?.organization} className="sm:col-span-2" /><Field name="payoutNote" label="Commission / Payout Note" defaultValue={partner?.payoutNote} className="sm:col-span-2" /><Field name="notes" label="Internal Notes" defaultValue={partner?.notes} className="sm:col-span-2" />{partner ? <Select name="status" label="Status" defaultValue={partner.status} options={["Active", "Inactive"]} /> : null}{error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}<div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button><button disabled={loading} className="h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? "Saving" : "Save profile"}</button></div></form></div></div>;
}

function Field({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  return <label className={className}><span className="text-sm font-bold text-[#394340]">{label}</span><input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue: string }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><select name={name} defaultValue={defaultValue} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
