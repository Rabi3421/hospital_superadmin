"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, CircleAlert, Clock3, Eye, Send, WalletCards, X } from "lucide-react";
import { StatusBadge, SummaryCard } from "../components/dashboard-ui";

type Payment = { _id: string; amount: number; paymentMode: string; transactionId?: string; status: string; paymentDate: string; source?: string };
type Reminder = { channel: string; sentAt: string; status: string };
type ReminderHistory = Reminder & { _id: string; stage: string; recipient: string; message: string; sentBy: string; billingMonth: string };
export type CollectionRow = {
  hospital: { hospitalId: string; name: string; ownerName: string; ownerEmail: string; ownerPhone: string; status: string } | null;
  subscription: { planName: string; monthlyPrice: number; status: string; nextBillingDate?: string; graceEndsAt?: string };
  billingMonth: string;
  stage: string;
  amountDue: number;
  payment: Payment | null;
  lastReminder: Reminder | null;
  reminderCount: number;
};

const button = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-bold transition disabled:opacity-40";

export default function CollectionsManager({ rows }: { rows: CollectionRow[] }) {
  const router = useRouter();
  const [stage, setStage] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [reminding, setReminding] = useState<CollectionRow | null>(null);
  const [history, setHistory] = useState<{ hospitalName: string; reminders: ReminderHistory[] } | null>(null);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesStage = !stage || row.stage === stage || (stage === "Pending Verification" && row.payment?.status === "Pending");
    const haystack = `${row.hospital?.name} ${row.hospital?.hospitalId} ${row.hospital?.ownerEmail}`.toLowerCase();
    return matchesStage && haystack.includes(query.toLowerCase());
  }), [query, rows, stage]);
  const receivable = rows.reduce((total, row) => total + row.amountDue, 0);
  const pending = rows.filter((row) => row.payment?.status === "Pending").length;
  const grace = rows.filter((row) => row.stage === "Grace").length;
  const suspended = rows.filter((row) => row.stage === "Suspended").length;

  async function paymentAction(paymentId: string, action: "verify" | "reject") {
    setLoading(paymentId);
    setError("");
    const reason = action === "reject" ? window.prompt("Reason for rejecting this payment submission:") : "";
    if (action === "reject" && !reason) {
      setLoading("");
      return;
    }
    const response = await fetch(`/api/superadmin/platform-payments/${paymentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    const result = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(result.message ?? "Unable to update payment");
      return;
    }
    setFeedback(result.message);
    router.refresh();
  }

  async function sendReminder(channel: string, message: string) {
    if (!reminding?.hospital) return;
    setLoading(reminding.hospital.hospitalId);
    setError("");
    const response = await fetch(`/api/superadmin/collections/${reminding.hospital.hospitalId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, message }),
    });
    const result = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(result.message ?? "Unable to log reminder");
      return;
    }
    setFeedback(result.message);
    setReminding(null);
    router.refresh();
  }

  async function loadReminderHistory(row: CollectionRow) {
    if (!row.hospital) return;
    setLoading(row.hospital.hospitalId);
    setError("");
    const response = await fetch(`/api/superadmin/collections/${row.hospital.hospitalId}/reminders`);
    const result = await response.json();
    setLoading("");
    if (!response.ok) {
      setError(result.message ?? "Unable to load reminder history");
      return;
    }
    setHistory({ hospitalName: row.hospital.name, reminders: result.data ?? [] });
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#151918]">Collections center</h1><p className="mt-1 text-sm font-medium text-[#7a8581]">Manage receivables, verify owner-submitted payments, track reminders, and follow overdue accounts.</p></div>
      {(feedback || error) ? <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-[#cde9df] bg-[#edf8f3] text-[#278b7c]"}`}>{error || feedback}</div> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Outstanding Receivable" value={`₹${receivable.toLocaleString("en-IN")}`} icon={WalletCards} />
        <SummaryCard label="Pending Verification" value={pending} icon={Clock3} tone="amber" />
        <SummaryCard label="In Grace Period" value={grace} icon={BellRing} tone="amber" />
        <SummaryCard label="Non-payment Suspended" value={suspended} icon={CircleAlert} tone="red" />
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 md:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search hospital, ID, or owner email" className="h-10 flex-1 rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" />
        <select value={stage} onChange={(event) => setStage(event.target.value)} className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm font-semibold"><option value="">All collection stages</option>{["Upcoming", "Due", "Grace", "Suspended", "Paid", "Trial", "Pending Verification"].map((item) => <option key={item}>{item}</option>)}</select>
      </section>
      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]"><tr><th className="px-4 py-4">Hospital</th><th className="px-4 py-4">Plan / Month</th><th className="px-4 py-4">Due Timeline</th><th className="px-4 py-4">Stage</th><th className="px-4 py-4">Receivable</th><th className="px-4 py-4">Payment Submission</th><th className="px-4 py-4">Reminders</th><th className="px-4 py-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-[#edf2ef]">{filtered.map((row) => <tr key={row.hospital?.hospitalId} className="hover:bg-[#fbfdfc]">
            <td className="px-4 py-4"><Link href={`/dashboard/hospitals/${row.hospital?.hospitalId}`} className="font-bold text-[#151918] hover:text-[#278b7c]">{row.hospital?.name}</Link><p className="mt-1 text-xs text-[#8a9591]">{row.hospital?.ownerEmail}</p></td>
            <td className="px-4 py-4"><p className="font-semibold text-[#394340]">{row.subscription.planName}</p><p className="mt-1 text-xs text-[#8a9591]">{row.billingMonth || "Trial period"}</p></td>
            <td className="px-4 py-4"><p className="font-semibold text-[#394340]">{row.subscription.nextBillingDate ? `Due ${new Date(row.subscription.nextBillingDate).toLocaleDateString()}` : "Not scheduled"}</p><p className="mt-1 text-xs text-[#8a9591]">{row.subscription.graceEndsAt ? `Grace to ${new Date(row.subscription.graceEndsAt).toLocaleDateString()}` : ""}</p></td>
            <td className="px-4 py-4"><StatusBadge value={row.stage} /></td>
            <td className="px-4 py-4 font-bold text-[#151918]">₹{row.amountDue.toLocaleString("en-IN")}</td>
            <td className="px-4 py-4">{row.payment ? <><StatusBadge value={row.payment.status} /><p className="mt-2 text-xs text-[#687370]">{row.payment.paymentMode} · {row.payment.transactionId || "No reference"}</p><p className="mt-1 text-[11px] font-semibold text-[#8a9591]">{row.payment.source || "Legacy record"}</p></> : <span className="text-xs font-semibold text-[#8a9591]">No submission</span>}</td>
            <td className="px-4 py-4"><button type="button" onClick={() => loadReminderHistory(row)} className="font-semibold text-[#394340] hover:text-[#278b7c]">{row.reminderCount} logged</button><p className="mt-1 text-xs text-[#8a9591]">{row.lastReminder ? `${row.lastReminder.channel} · ${new Date(row.lastReminder.sentAt).toLocaleDateString()}` : "No reminder yet"}</p></td>
            <td className="px-4 py-4"><div className="flex justify-end gap-2">{row.payment?.status === "Pending" ? <><button disabled={loading === row.payment._id} onClick={() => paymentAction(row.payment!._id, "verify")} className={`${button} bg-[#278b7c] text-white hover:bg-[#1f7b6f]`}><Check size={15} /> Verify</button><button disabled={loading === row.payment._id} onClick={() => paymentAction(row.payment!._id, "reject")} className={`${button} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}><X size={15} /> Reject</button></> : null}<button onClick={() => setReminding(row)} disabled={["Paid", "Trial"].includes(row.stage)} className={`${button} border border-[#dfe8e4] text-[#394340] hover:bg-[#edf8f3]`}><Send size={15} /> Reminder</button><Link href={`/dashboard/platform-payments?hospitalId=${row.hospital?.hospitalId}`} className={`${button} border border-[#dfe8e4] text-[#394340] hover:bg-[#edf8f3]`}><Eye size={15} /> History</Link></div></td>
          </tr>)}</tbody>
        </table>
      </section>
      {reminding?.hospital ? <ReminderDialog row={reminding} loading={loading === reminding.hospital.hospitalId} onClose={() => setReminding(null)} onSubmit={sendReminder} /> : null}
      {history ? <ReminderHistoryDialog history={history} onClose={() => setHistory(null)} /> : null}
    </div>
  );
}

function ReminderDialog({ row, loading, onClose, onSubmit }: { row: CollectionRow; loading: boolean; onClose(): void; onSubmit(channel: string, message: string): void }) {
  const [channel, setChannel] = useState("Email");
  const [message, setMessage] = useState("");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4" onMouseDown={onClose}><div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#151918]">Log payment reminder</h2><p className="mt-1 text-sm text-[#7a8581]">{row.hospital?.name} · {row.stage} · ₹{row.amountDue.toLocaleString("en-IN")}</p></div><button onClick={onClose}><X size={20} /></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-bold text-[#394340]">Channel<select value={channel} onChange={(event) => setChannel(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3"><option>Email</option><option>Phone</option><option>WhatsApp</option><option>In App</option></select></label><label className="block text-sm font-bold text-[#394340]">Custom message (optional)<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={1000} placeholder="Leave empty to use the recommended message for this collection stage." className="mt-2 w-full rounded-md border border-[#dfe8e4] p-3 text-sm" /></label><p className="text-xs text-[#8a9591]">Email, phone, and WhatsApp reminders are recorded for follow-up. Connect a messaging provider before treating them as automatically delivered.</p><div className="flex justify-end gap-3"><button onClick={onClose} className={`${button} border border-[#dfe8e4]`}>Cancel</button><button disabled={loading} onClick={() => onSubmit(channel, message)} className={`${button} bg-[#278b7c] text-white`}>{loading ? "Logging..." : "Log reminder"}</button></div></div></div></div>;
}

function ReminderHistoryDialog({ history, onClose }: { history: { hospitalName: string; reminders: ReminderHistory[] }; onClose(): void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4" onMouseDown={onClose}><div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-[#edf2ef] p-5"><div><h2 className="text-lg font-bold text-[#151918]">Reminder history</h2><p className="mt-1 text-sm text-[#7a8581]">{history.hospitalName} · {history.reminders.length} records</p></div><button onClick={onClose}><X size={20} /></button></div><div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">{history.reminders.length ? history.reminders.map((reminder) => <article key={reminder._id} className="rounded-lg border border-[#e2eae6] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StatusBadge value={reminder.stage} /><span className="text-xs font-bold text-[#687370]">{reminder.channel} · {reminder.billingMonth}</span></div><span className="text-xs font-semibold text-[#8a9591]">{new Date(reminder.sentAt).toLocaleString()}</span></div><p className="mt-3 text-sm leading-6 text-[#394340]">{reminder.message}</p><p className="mt-3 text-xs font-semibold text-[#8a9591]">Recipient: {reminder.recipient} · Logged by {reminder.sentBy} · {reminder.status}</p></article>) : <p className="py-10 text-center text-sm font-semibold text-[#8a9591]">No reminders logged.</p>}</div></div></div>;
}
