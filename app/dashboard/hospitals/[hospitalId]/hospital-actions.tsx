"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  CreditCard,
  Globe2,
  Loader2,
} from "lucide-react";

type WebsiteStatus = "Live" | "Maintenance" | "Coming Soon";

export default function HospitalActions({
  hospitalId,
  hospitalStatus,
  currentWebsiteStatus,
}: {
  hospitalId: string;
  hospitalStatus: string;
  currentWebsiteStatus: WebsiteStatus;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState("");
  const [websiteStatus, setWebsiteStatus] = useState<WebsiteStatus>(currentWebsiteStatus);
  const [trialDays, setTrialDays] = useState("7");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function runHospitalAction(action: "activate" | "suspend" | "cancel") {
    if (action === "cancel" && !window.confirm("Cancel this hospital? This will also cancel its subscription and disable the website.")) {
      return;
    }

    resetFeedback();
    setLoadingAction(action);
    const response = await fetch(`/api/superadmin/hospitals/${hospitalId}/${action}`, { method: "POST" });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? `Unable to ${action} hospital`);
      return;
    }

    setMessage(`Hospital ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : "cancelled"}.`);
    router.refresh();
  }

  async function updateWebsiteStatus() {
    resetFeedback();
    setLoadingAction("website");
    const response = await fetch(`/api/superadmin/hospitals/${hospitalId}/website-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteStatus }),
    });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? "Unable to update website status");
      return;
    }

    setMessage(`Website set to ${websiteStatus}.`);
    router.refresh();
  }

  async function extendTrial() {
    const days = Number(trialDays);
    if (!Number.isFinite(days) || days < 1) {
      setError("Enter a valid number of trial days.");
      return;
    }

    resetFeedback();
    setLoadingAction("trial");
    const response = await fetch(`/api/superadmin/subscriptions/${hospitalId}/extend-trial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    const result = await response.json();
    setLoadingAction("");

    if (!response.ok) {
      setError(result.message ?? "Unable to extend trial");
      return;
    }

    setMessage(`Trial extended by ${days} days.`);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.05)]">
      <div className="flex flex-col justify-between gap-3 border-b border-[#edf2ef] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold text-[#151918]">Hospital Management</h2>
          <p className="mt-1 text-xs font-semibold text-[#8a9591]">Control access, website visibility, and subscription timing.</p>
        </div>
        <Link
          href={`/dashboard/subscriptions?hospitalId=${hospitalId}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] px-3 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5]"
        >
          <CreditCard size={16} />
          Manage Subscription
        </Link>
      </div>

      <div className="grid divide-y divide-[#edf2ef] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <div className="flex items-center gap-2">
            <CirclePlay size={17} className="text-[#278b7c]" />
            <h3 className="text-sm font-bold text-[#151918]">Hospital access</h3>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#8a9591]">Current status: {hospitalStatus}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => runHospitalAction("activate")}
              disabled={Boolean(loadingAction) || hospitalStatus === "Active"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#278b7c] px-3 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingAction === "activate" ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Activate
            </button>
            <button
              type="button"
              onClick={() => runHospitalAction("suspend")}
              disabled={Boolean(loadingAction) || hospitalStatus === "Suspended"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] px-3 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingAction === "suspend" ? <Loader2 className="animate-spin" size={16} /> : <CirclePause size={16} />}
              Suspend
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2">
            <Globe2 size={17} className="text-[#278b7c]" />
            <h3 className="text-sm font-bold text-[#151918]">Public website</h3>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#8a9591]">Choose what visitors see.</p>
          <div className="mt-4 flex gap-2">
            <select
              value={websiteStatus}
              onChange={(event) => setWebsiteStatus(event.target.value as WebsiteStatus)}
              className="h-10 min-w-0 flex-1 rounded-md border border-[#dfe8e4] bg-white px-3 text-sm font-semibold outline-none focus:border-[#278b7c]"
            >
              <option>Live</option>
              <option>Maintenance</option>
              <option>Coming Soon</option>
            </select>
            <button
              type="button"
              onClick={updateWebsiteStatus}
              disabled={Boolean(loadingAction) || websiteStatus === currentWebsiteStatus}
              className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingAction === "website" ? "Saving" : "Apply"}
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2">
            <CalendarPlus size={17} className="text-[#278b7c]" />
            <h3 className="text-sm font-bold text-[#151918]">Trial period</h3>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#8a9591]">Extend access without changing the plan.</p>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <input
                value={trialDays}
                onChange={(event) => setTrialDays(event.target.value)}
                type="number"
                min="1"
                className="h-10 w-full rounded-md border border-[#dfe8e4] px-3 pr-12 text-sm font-semibold outline-none focus:border-[#278b7c]"
              />
              <span className="pointer-events-none absolute right-3 top-3 text-xs font-bold text-[#8a9591]">days</span>
            </div>
            <button
              type="button"
              onClick={extendTrial}
              disabled={Boolean(loadingAction)}
              className="h-10 rounded-md border border-[#dfe8e4] px-3 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5] disabled:opacity-40"
            >
              {loadingAction === "trial" ? "Extending" : "Extend"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 border-t border-[#edf2ef] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          {message ? <p className="text-sm font-semibold text-[#278b7c]">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          {!message && !error ? <p className="text-xs font-semibold text-[#8a9591]">Cancellation is permanent and requires confirmation.</p> : null}
        </div>
        <button
          type="button"
          onClick={() => runHospitalAction("cancel")}
          disabled={Boolean(loadingAction) || hospitalStatus === "Cancelled"}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ban size={16} />
          {loadingAction === "cancel" ? "Cancelling" : "Cancel Hospital"}
        </button>
      </div>
    </section>
  );
}
