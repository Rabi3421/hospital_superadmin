"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyHospitalId({ hospitalId }: { hospitalId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(hospitalId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy hospital ID"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dfe8e4] bg-white px-2.5 text-xs font-bold text-[#687370] hover:bg-[#f3f7f5]"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : hospitalId}
    </button>
  );
}
