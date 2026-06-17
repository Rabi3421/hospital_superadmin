"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { normalizeSubscriptionPlanName, subscriptionPlanNames } from "@/lib/subscription-plans";

type HospitalEditData = {
  hospitalId: string;
  name: string;
  type: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  referredBy?: string;
  referralPartnerId?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  logoUrl?: string;
  registrationNumber?: string;
  gstNumber?: string;
  websiteStatus: string;
  status: string;
  subscriptionPlan: string;
  monthlyPrice: number;
  maxDoctors: number;
  maxStaff: number;
  maxPatients: number;
};

type ReferralPartner = { referralPartnerId: string; name: string; organization?: string; type: string };

export default function EditHospitalForm({ hospital, referralPartners }: { hospital: HospitalEditData; referralPartners: ReferralPartner[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    const response = await fetch(`/api/superadmin/hospitals/${hospital.hospitalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.message ?? "Unable to update hospital");
      return;
    }

    router.push(`/dashboard/hospitals/${hospital.hospitalId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-[#edf2ef] bg-white shadow-sm">
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Hospital profile" description="Core hospital information shown across the superadmin dashboard.">
            <Field name="name" label="Hospital Name" defaultValue={hospital.name} required />
            <Select name="type" label="Type" defaultValue={hospital.type} options={["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"]} />
            <Field name="address" label="Address" defaultValue={hospital.address} required className="md:col-span-2" />
            <Field name="city" label="City" defaultValue={hospital.city} required />
            <Field name="state" label="State" defaultValue={hospital.state} required />
            <Field name="pincode" label="Pincode" defaultValue={hospital.pincode} required />
          </Section>

          <Section title="Owner contact" description="Primary contact details for business and account communication.">
            <Field name="ownerName" label="Owner Name" defaultValue={hospital.ownerName} required />
            <Field name="ownerPhone" label="Owner Phone" defaultValue={hospital.ownerPhone} required />
            <Field name="ownerEmail" label="Owner Email" type="email" defaultValue={hospital.ownerEmail} required className="md:col-span-2" />
          </Section>

          <Section title="Referral source" description="Track the person who introduced or acquired this hospital client. Use Direct / Self when there is no external reference.">
            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-[#394340]">Reference Person / Referred By</span>
              <select name="referralPartnerId" defaultValue={hospital.referralPartnerId ?? ""} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]">
                <option value="">Direct / Self (no external reference)</option>
                {referralPartners.map((partner) => <option key={partner.referralPartnerId} value={partner.referralPartnerId}>{partner.name}{partner.organization ? ` · ${partner.organization}` : ""} ({partner.type})</option>)}
              </select>
              {!hospital.referralPartnerId && hospital.referredBy && hospital.referredBy !== "Direct / Self" ? <p className="mt-2 text-xs font-semibold text-amber-700">Legacy reference “{hospital.referredBy}” is not linked to a profile. Select a profile or Direct / Self before saving.</p> : null}
            </label>
          </Section>

          <Section title="Registration and branding" description="Optional public and compliance details.">
            <Field name="registrationNumber" label="Registration Number" defaultValue={hospital.registrationNumber ?? ""} />
            <Field name="gstNumber" label="GST Number" defaultValue={hospital.gstNumber ?? ""} />
            <Field name="logoUrl" label="Logo URL" defaultValue={hospital.logoUrl ?? ""} className="md:col-span-2" />
          </Section>
        </div>

        <aside className="h-fit rounded-lg border border-[#edf2ef] bg-[#f8fbfa] p-4">
          <p className="text-sm font-bold text-slate-950">Plan, status, and limits</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Manage subscription state, website state, pricing, and usage caps.</p>
          <div className="mt-5 grid gap-4">
            <Select name="status" label="Hospital Status" defaultValue={hospital.status} options={["Trial", "Active", "Suspended", "Cancelled", "Pending"]} />
            <Select name="websiteStatus" label="Website Status" defaultValue={hospital.websiteStatus} options={["Live", "Maintenance", "Coming Soon"]} />
            <Select name="subscriptionPlan" label="Subscription Plan" defaultValue={normalizeSubscriptionPlanName(hospital.subscriptionPlan)} options={[...subscriptionPlanNames]} />
            <p className="rounded-md border border-teal-100 bg-white p-3 text-xs leading-5 text-slate-600">
              Price and capacity limits are automatically updated from the selected plan catalog.
            </p>
          </div>
        </aside>
      </div>
      {error ? <p className="px-5 pb-4 text-sm font-semibold text-red-600">{error}</p> : null}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={loading}
          onClick={() => router.push(`/dashboard/hospitals/${hospital.hospitalId}`)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5] disabled:opacity-60"
        >
          <X size={17} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-60"
        >
          <Save size={17} />
          {loading ? "Saving" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#edf2ef] bg-white p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-bold text-[#394340]">{label}</span>
      <input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#394340]">{label}</span>
      <select name={name} defaultValue={defaultValue} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
