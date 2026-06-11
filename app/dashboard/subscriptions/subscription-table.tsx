"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CircleAlert,
  Eye,
  Loader2,
  Pencil,
  X,
} from "lucide-react";

export type SubscriptionRow = {
  hospitalId: string;
  hospitalName: string;
  planName: string;
  monthlyPrice: number;
  billingCycle: string;
  status: string;
  nextBillingDate?: string;
  endDate?: string;
};

export default function SubscriptionTable({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [extending, setExtending] = useState<SubscriptionRow | null>(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function updateSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    resetFeedback();
    setLoadingAction("update");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/superadmin/subscriptions/${editing.hospitalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? "Unable to update subscription");
      return;
    }

    setEditing(null);
    setMessage(`${editing.hospitalName} subscription updated.`);
    router.refresh();
  }

  async function extendTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!extending) return;
    resetFeedback();
    setLoadingAction("extend");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/superadmin/subscriptions/${extending.hospitalId}/extend-trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: Number(form.get("days")) }),
    });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? "Unable to extend trial");
      return;
    }

    setExtending(null);
    setMessage(`${extending.hospitalName} trial extended.`);
    router.refresh();
  }

  async function markOverdue(subscription: SubscriptionRow) {
    if (!window.confirm(`Mark ${subscription.hospitalName} subscription as overdue?`)) return;
    resetFeedback();
    setLoadingAction(subscription.hospitalId);
    const response = await fetch(`/api/superadmin/subscriptions/${subscription.hospitalId}/mark-overdue`, { method: "POST" });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? "Unable to mark subscription overdue");
      return;
    }

    setMessage(`${subscription.hospitalName} marked overdue.`);
    router.refresh();
  }

  return (
    <>
      {(message || error) ? (
        <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#cde9df] bg-[#edf8f3] text-[#278b7c]"}`}>
          {error || message}
        </div>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]">
            <tr>
              <th className="px-5 py-4">Hospital</th>
              <th className="px-5 py-4">Plan</th>
              <th className="px-5 py-4">Price</th>
              <th className="px-5 py-4">Billing Cycle</th>
              <th className="px-5 py-4">Next Billing</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2ef]">
            {subscriptions.map((subscription) => (
              <tr key={subscription.hospitalId} className="transition hover:bg-[#fbfdfc]">
                <td className="px-5 py-4">
                  <Link href={`/dashboard/hospitals/${subscription.hospitalId}`} className="font-bold text-[#151918] hover:text-[#278b7c]">
                    {subscription.hospitalName}
                  </Link>
                  <p className="mt-1 text-xs font-semibold text-[#8a9591]">{subscription.hospitalId}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-[#394340]">{subscription.planName}</td>
                <td className="px-5 py-4 font-bold text-[#151918]">₹{subscription.monthlyPrice}</td>
                <td className="px-5 py-4 font-semibold text-[#394340]">{subscription.billingCycle}</td>
                <td className="px-5 py-4 font-semibold text-[#394340]">
                  {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : "Not scheduled"}
                </td>
                <td className="px-5 py-4"><StatusBadge value={subscription.status} /></td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/dashboard/hospitals/${subscription.hospitalId}`} title="View hospital" className={iconButton}>
                      <Eye size={16} />
                    </Link>
                    <button type="button" onClick={() => setEditing(subscription)} title="Edit subscription" className={iconButton}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => setExtending(subscription)} title="Extend trial" className={iconButton}>
                      <CalendarPlus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => markOverdue(subscription)}
                      disabled={loadingAction === subscription.hospitalId || subscription.status === "Overdue"}
                      title={subscription.status === "Overdue" ? "Already overdue" : "Mark overdue"}
                      className={`${iconButton} hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-35`}
                    >
                      {loadingAction === subscription.hospitalId ? <Loader2 className="animate-spin" size={16} /> : <CircleAlert size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center font-semibold text-[#8a9591]">No subscriptions found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {editing ? (
        <Dialog title="Edit Subscription" description={`${editing.hospitalName} · ${editing.hospitalId}`} onClose={() => setEditing(null)}>
          <form onSubmit={updateSubscription} className="grid gap-4 sm:grid-cols-2">
            <Field name="planName" label="Plan Name" defaultValue={editing.planName} required />
            <Field name="monthlyPrice" label="Monthly Price" type="number" defaultValue={editing.monthlyPrice} required />
            <Select name="billingCycle" label="Billing Cycle" defaultValue={editing.billingCycle} options={["Monthly", "Quarterly", "Yearly"]} />
            <Select name="status" label="Status" defaultValue={editing.status} options={["Trial", "Active", "Overdue", "Suspended", "Cancelled"]} />
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>Cancel</button>
              <button type="submit" disabled={Boolean(loadingAction)} className={primaryButton}>
                {loadingAction === "update" ? "Saving" : "Save Changes"}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {extending ? (
        <Dialog title="Extend Trial" description={`${extending.hospitalName} · Current end: ${extending.endDate ? new Date(extending.endDate).toLocaleDateString() : "Not set"}`} onClose={() => setExtending(null)}>
          <form onSubmit={extendTrial} className="space-y-5">
            <Field name="days" label="Additional Trial Days" type="number" min="1" defaultValue="7" required />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setExtending(null)} className={secondaryButton}>Cancel</button>
              <button type="submit" disabled={Boolean(loadingAction)} className={primaryButton}>
                {loadingAction === "extend" ? "Extending" : "Extend Trial"}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] bg-white text-[#394340] transition hover:border-[#b9d7ce] hover:bg-[#edf8f3] hover:text-[#278b7c]";
const primaryButton = "h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-50";
const secondaryButton = "h-10 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5]";

function Dialog({ title, description, onClose, children }: { title: string; description: string; onClose(): void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-[#e2eae6] bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#151918]">{title}</h2>
            <p className="mt-1 text-xs font-semibold text-[#8a9591]">{description}</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className={iconButton}><X size={17} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block"><span className="text-sm font-bold text-[#394340]">{label}</span><input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" /></label>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue: string }) {
  return <label className="block"><span className="text-sm font-bold text-[#394340]">{label}</span><select name={name} defaultValue={defaultValue} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function StatusBadge({ value }: { value: string }) {
  const style =
    value === "Active" ? "bg-[#e2f6f1] text-[#278b7c]" :
    value === "Overdue" || value === "Suspended" || value === "Cancelled" ? "bg-[#fdeae5] text-[#b95f45]" :
    "bg-[#fff2d6] text-[#a87918]";
  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${style}`}>{value}</span>;
}
