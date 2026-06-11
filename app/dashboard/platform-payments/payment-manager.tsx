"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Eye, Pencil, Plus, X } from "lucide-react";
import { EmptyState, StatusBadge } from "../components/dashboard-ui";

type HospitalOption = { hospitalId: string; name: string };
export type PaymentRow = {
  _id: string;
  hospitalId: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  transactionId?: string;
  billingMonth: string;
  status: string;
  notes?: string;
};

export default function PaymentManager({ hospitals, payments }: { hospitals: HospitalOption[]; payments: PaymentRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hospitalMap = new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital.name]));

  async function submit(event: FormEvent<HTMLFormElement>, paymentId?: string) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch(paymentId ? `/api/superadmin/platform-payments/${paymentId}` : "/api/superadmin/platform-payments", {
      method: paymentId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.message ?? "Unable to save payment");
      return;
    }
    setCreating(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} disabled={!hospitals.length} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-40">
          <Plus size={16} /> Add Payment
        </button>
      </div>
      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
        {payments.length ? (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]">
              <tr><th className="px-5 py-4">Hospital</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Billing Month</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th><th className="px-5 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ef]">
              {payments.map((payment) => (
                <tr key={payment._id} className="hover:bg-[#fbfdfc]">
                  <td className="px-5 py-4"><Link href={`/dashboard/hospitals/${payment.hospitalId}`} className="font-bold text-[#151918] hover:text-[#278b7c]">{hospitalMap.get(payment.hospitalId) ?? payment.hospitalId}</Link><p className="mt-1 text-xs font-semibold text-[#8a9591]">{payment.hospitalId}</p></td>
                  <td className="px-5 py-4 text-base font-bold text-[#151918]">₹{payment.amount}</td>
                  <td className="px-5 py-4"><p className="font-semibold text-[#394340]">{payment.paymentMode}</p><p className="mt-1 text-xs text-[#8a9591]">{payment.transactionId || "No transaction ID"}</p></td>
                  <td className="px-5 py-4 font-semibold text-[#394340]">{payment.billingMonth}</td>
                  <td className="px-5 py-4"><StatusBadge value={payment.status} /></td>
                  <td className="px-5 py-4 font-semibold text-[#394340]">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><Link href={`/dashboard/hospitals/${payment.hospitalId}`} title="View hospital" className={iconButton}><Eye size={16} /></Link><button title="Edit payment" onClick={() => setEditing(payment)} className={iconButton}><Pencil size={16} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={CreditCard} title="No payments found" description="Adjust the filters or record the first platform subscription payment." action={<button onClick={() => setCreating(true)} className="rounded-md bg-[#278b7c] px-4 py-2 text-sm font-bold text-white">Add Payment</button>} />
        )}
      </section>
      {creating ? <PaymentDialog title="Add Platform Payment" hospitals={hospitals} loading={loading} error={error} onClose={() => setCreating(false)} onSubmit={(event) => submit(event)} /> : null}
      {editing ? <PaymentDialog title="Edit Platform Payment" hospitals={hospitals} payment={editing} loading={loading} error={error} onClose={() => setEditing(null)} onSubmit={(event) => submit(event, editing._id)} /> : null}
    </>
  );
}

const iconButton = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] text-[#394340] hover:bg-[#edf8f3] hover:text-[#278b7c]";

function PaymentDialog({ title, hospitals, payment, loading, error, onClose, onSubmit }: { title: string; hospitals: HospitalOption[]; payment?: PaymentRow; loading: boolean; error: string; onClose(): void; onSubmit(event: FormEvent<HTMLFormElement>): void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4"><div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs font-semibold text-[#8a9591]">Platform subscription payment, separate from patient billing.</p></div><button onClick={onClose} title="Close" className={iconButton}><X size={17} /></button></div>
        <form onSubmit={onSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
          <Select name="hospitalId" label="Hospital" defaultValue={payment?.hospitalId} options={hospitals.map((item) => [item.hospitalId, item.name])} />
          <Field name="amount" label="Amount" type="number" defaultValue={payment?.amount} required />
          <Field name="paymentDate" label="Payment Date" type="date" defaultValue={payment?.paymentDate?.slice(0, 10)} required />
          <Field name="billingMonth" label="Billing Month" placeholder="2026-06" defaultValue={payment?.billingMonth} required />
          <Select name="paymentMode" label="Payment Mode" defaultValue={payment?.paymentMode} options={["Cash", "UPI", "Bank Transfer", "Card", "Online"].map((item) => [item, item])} />
          <Select name="status" label="Status" defaultValue={payment?.status} options={["Paid", "Pending", "Failed", "Refunded"].map((item) => [item, item])} />
          <Field name="transactionId" label="Transaction ID" defaultValue={payment?.transactionId} />
          <Field name="notes" label="Notes" defaultValue={payment?.notes} />
          {error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button><button disabled={loading} className="h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? "Saving" : "Save Payment"}</button></div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><select name={name} defaultValue={defaultValue} required className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}
