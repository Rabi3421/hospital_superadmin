"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CirclePause, CirclePlay, Copy, Eye, Loader2, Pencil, Trash2 } from "lucide-react";

export default function HospitalRowActions({
  hospitalId,
  hospitalStatus,
}: {
  hospitalId: string;
  hospitalStatus: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");

  async function copyHospitalId() {
    await navigator.clipboard.writeText(hospitalId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function runAction(action: "activate" | "suspend") {
    if (action === "suspend" && !window.confirm("Suspend this hospital? Hospital users will no longer be able to sign in.")) {
      return;
    }

    setLoadingAction(action);
    const response = await fetch(`/api/superadmin/hospitals/${hospitalId}/${action}`, { method: "POST" });
    setLoadingAction("");
    if (response.ok) router.refresh();
  }

  async function deleteHospital() {
    const confirmed = window.confirm(
      `Delete hospital ${hospitalId}? This permanently removes the hospital, subscription, users, patients, appointments, billing, lab, pharmacy, and public content data.`,
    );
    if (!confirmed) return;

    setLoadingAction("delete");
    const response = await fetch(`/api/superadmin/hospitals/${hospitalId}`, { method: "DELETE" });
    setLoadingAction("");
    if (response.ok) router.refresh();
  }

  const iconButton =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] bg-white text-[#394340] transition hover:border-[#b9d7ce] hover:bg-[#edf8f3] hover:text-[#278b7c] disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div className="flex min-w-[270px] items-center gap-2">
      <button type="button" onClick={copyHospitalId} aria-label="Copy hospital ID" className={iconButton} title="Copy hospital ID">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <Link
        href={`/dashboard/hospitals/${hospitalId}`}
        aria-label="View hospital details"
        title="View hospital details"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#278b7c] text-white transition hover:bg-[#1f7b6f]"
      >
        <Eye size={16} />
      </Link>
      <Link
        href={`/dashboard/hospitals/${hospitalId}/edit`}
        aria-label="Edit hospital"
        title="Edit hospital"
        className={iconButton}
      >
        <Pencil size={16} />
      </Link>
      <button
        type="button"
        onClick={() => runAction("activate")}
        disabled={Boolean(loadingAction) || hospitalStatus === "Active"}
        aria-label="Activate hospital"
        title={hospitalStatus === "Active" ? "Hospital is already active" : "Activate hospital"}
        className={iconButton}
      >
        {loadingAction === "activate" ? <Loader2 className="animate-spin" size={16} /> : <CirclePlay size={16} />}
      </button>
      <button
        type="button"
        onClick={() => runAction("suspend")}
        disabled={Boolean(loadingAction) || hospitalStatus === "Suspended"}
        aria-label="Suspend hospital"
        title={hospitalStatus === "Suspended" ? "Hospital is already suspended" : "Suspend hospital"}
        className={`${iconButton} hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
      >
        {loadingAction === "suspend" ? <Loader2 className="animate-spin" size={16} /> : <CirclePause size={16} />}
      </button>
      <button
        type="button"
        onClick={deleteHospital}
        disabled={Boolean(loadingAction)}
        aria-label="Delete hospital"
        title="Delete hospital permanently"
        className={`${iconButton} text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800`}
      >
        {loadingAction === "delete" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
      </button>
    </div>
  );
}
