"use client";

import { FormEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Plus, UserRound, X } from "lucide-react";
import { subscriptionPlans } from "@/lib/subscription-plans";

type ReferralPartner = {
  referralPartnerId: string;
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
  type: string;
};

export default function NewHospitalForm({ initialReferralPartners }: { initialReferralPartners: ReferralPartner[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPlanName, setSelectedPlanName] = useState(subscriptionPlans[0].name);
  const [selectedPrice, setSelectedPrice] = useState<number>(subscriptionPlans[0].priceOptions[0]);
  const [referralPartners, setReferralPartners] = useState(initialReferralPartners);
  const [selectedReferralPartnerId, setSelectedReferralPartnerId] = useState("");
  const [addingReferralPartner, setAddingReferralPartner] = useState(false);
  const [savingReferralPartner, setSavingReferralPartner] = useState(false);
  const [referralError, setReferralError] = useState("");
  const submittingRef = useRef(false);
  const selectedPlan = subscriptionPlans.find((plan) => plan.name === selectedPlanName) ?? subscriptionPlans[0];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const payload = {
      name: value("name"),
      type: value("type"),
      address: value("address"),
      city: value("city"),
      state: value("state"),
      pincode: value("pincode"),
      ownerName: value("ownerName"),
      ownerPhone: value("ownerPhone"),
      ownerEmail: value("ownerEmail"),
      referredBy: selectedReferralPartnerId
        ? referralPartners.find((partner) => partner.referralPartnerId === selectedReferralPartnerId)?.name ?? ""
        : "Direct / Self",
      referralPartnerId: selectedReferralPartnerId,
      registrationNumber: value("registrationNumber"),
      gstNumber: value("gstNumber"),
      logoUrl: value("logoUrl"),
      subscriptionPlan: value("subscriptionPlan"),
      monthlyPrice: value("monthlyPrice"),
      pricingNote: value("pricingNote"),
      initialUser: {
        name: value("ownerName"),
        email: value("ownerEmail"),
        phone: value("ownerPhone"),
        password: value("ownerPassword"),
        role: "HOSPITAL_OWNER",
      },
    };
    try {
      const response = await fetch("/api/superadmin/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "Unable to create hospital");
        submittingRef.current = false;
        setLoading(false);
        return;
      }

      router.push(`/dashboard/hospitals/${result.data.hospital.hospitalId}`);
      router.refresh();
    } catch {
      setError("Unable to create hospital. Please try again.");
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function createReferralPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingReferralPartner(true);
    setReferralError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/superadmin/referral-partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setSavingReferralPartner(false);
    if (!response.ok) {
      setReferralError(result.message ?? "Unable to create referral partner");
      return;
    }
    const partner = result.data as ReferralPartner;
    setReferralPartners((current) => [...current, partner].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedReferralPartnerId(partner.referralPartnerId);
    setAddingReferralPartner(false);
  }

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Hospital profile" description="Core tenant details used across billing, public pages, and internal management.">
            <Field name="name" label="Hospital Name" required />
            <Select name="type" label="Type" options={["Clinic", "Hospital", "Diagnostic Center", "Nursing Home"]} />
            <Field name="address" label="Address" required className="md:col-span-2" />
            <Field name="city" label="City" required />
            <Field name="state" label="State" required />
            <Field name="pincode" label="Pincode" required />
          </Section>

          <Section title="Owner contact" description="The owner will be the primary contact and first login user for this hospital.">
            <Field name="ownerName" label="Owner Name" required />
            <Field name="ownerPhone" label="Owner Phone" required />
            <Field name="ownerEmail" label="Owner Email" type="email" required />
            <Field
              name="ownerPassword"
              label="Temporary Password"
              type="password"
              minLength={8}
              required
            />
          </Section>

          <Section title="Referral source" description="Track the person who introduced or acquired this hospital client. Use Direct / Self when there is no external reference.">
            <div className="md:col-span-2">
              <div className="flex items-end gap-3">
                <label className="block flex-1">
                  <span className="text-sm font-medium text-slate-700">Reference Person / Referred By</span>
                  <select
                    value={selectedReferralPartnerId}
                    onChange={(event) => setSelectedReferralPartnerId(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
                  >
                    <option value="">Direct / Self (no external reference)</option>
                    {referralPartners.map((partner) => (
                      <option key={partner.referralPartnerId} value={partner.referralPartnerId}>
                        {partner.name}{partner.organization ? ` · ${partner.organization}` : ""} ({partner.type})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setAddingReferralPartner(true)} className="inline-flex h-10 items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 text-sm font-bold text-teal-800 hover:bg-teal-100">
                  <Plus size={16} /> Add person
                </button>
              </div>
              {selectedReferralPartnerId ? (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Selected profile: {referralPartners.find((partner) => partner.referralPartnerId === selectedReferralPartnerId)?.name} · {selectedReferralPartnerId}
                </p>
              ) : null}
            </div>
          </Section>

          <Section title="Registration and branding" description="Optional public and compliance information.">
            <Field name="registrationNumber" label="Registration Number" />
            <Field name="gstNumber" label="GST Number" />
            <Field name="logoUrl" label="Logo URL" className="md:col-span-2" />
          </Section>
        </div>

        <aside className="h-fit rounded-lg border border-[#edf2ef] bg-[#f8fbfa] p-4">
          <p className="text-sm font-bold text-slate-950">Plan and limits</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Choose a controlled plan. Pricing and limits are applied automatically.</p>
          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Subscription Plan</span>
              <select
                name="subscriptionPlan"
                value={selectedPlanName}
                onChange={(event) => {
                  const nextName = event.target.value as typeof selectedPlanName;
                  const nextPlan = subscriptionPlans.find((plan) => plan.name === nextName) ?? subscriptionPlans[0];
                  setSelectedPlanName(nextName);
                  setSelectedPrice(nextPlan.priceOptions[0]);
                }}
                className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
              >
                {subscriptionPlans.map((plan) => <option key={plan.name}>{plan.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Approved Monthly Price</span>
              <select
                name="monthlyPrice"
                value={selectedPrice}
                onChange={(event) => setSelectedPrice(Number(event.target.value))}
                className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
              >
                {(selectedPlan.priceOptions as readonly number[]).map((price, index) => (
                  <option key={price} value={price}>
                    {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}${index > 0 ? " (negotiated)" : ""}`}
                  </option>
                ))}
              </select>
            </label>
            {selectedPrice > 0 && selectedPrice !== selectedPlan.priceOptions[0] ? (
              <Field name="pricingNote" label="Negotiation Approval Note" placeholder="Reason, approver, or agreed commercial terms" required />
            ) : null}
            <div className="rounded-md border border-teal-100 bg-white p-4">
              <p className="text-lg font-bold text-slate-950">
                {selectedPrice === 0 ? "Free for 30 days" : `₹${selectedPrice.toLocaleString("en-IN")}`}
                {selectedPrice > 0 ? <span className="text-xs font-medium text-slate-500"> / month after trial</span> : null}
              </p>
              <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800">Every new hospital receives 30 days of full platform access.</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{selectedPlan.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <PlanLimit label="Doctors" value={selectedPlan.maxDoctors} />
                <PlanLimit label="Staff" value={selectedPlan.maxStaff} />
                <PlanLimit label="Patients" value={selectedPlan.maxPatients} />
              </dl>
              <ul className="mt-4 space-y-1 text-xs text-slate-600">
                {selectedPlan.features.map((feature) => <li key={feature}>• {feature}</li>)}
              </ul>
            </div>
          </div>
        </aside>
      </div>
      {error ? <p className="px-5 pb-4 text-sm font-semibold text-red-600">{error}</p> : null}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-white/95 p-4 backdrop-blur">
        <button
          type="button"
          disabled={loading}
          onClick={() => router.push("/dashboard/hospitals")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#dfe8e4] bg-white px-4 text-sm font-bold text-[#394340] hover:bg-[#f3f7f5] disabled:opacity-60"
        >
          <X size={17} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          <Building2 size={18} />
          {loading ? "Creating" : "Create Hospital"}
        </button>
      </div>
      {addingReferralPartner && typeof document !== "undefined"
        ? createPortal(
            <ReferralPartnerDialog
              error={referralError}
              loading={savingReferralPartner}
              onClose={() => setAddingReferralPartner(false)}
              onSubmit={createReferralPartner}
            />,
            document.body,
          )
        : null}
    </form>
  );
}

function ReferralPartnerDialog({
  error,
  loading,
  onClose,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  onClose(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-lg font-bold text-slate-950">Add referral partner</h2><p className="mt-1 text-xs text-slate-500">Create once, then reuse this profile for future hospital onboarding.</p></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200"><X size={17} /></button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field name="name" label="Full Name" required />
          <Select name="type" label="Profile Type" options={["Individual", "Employee", "Agency", "Partner"]} />
          <Field name="phone" label="Phone" />
          <Field name="email" label="Email" type="email" />
          <Field name="organization" label="Organization / Company" className="sm:col-span-2" />
          <Field name="payoutNote" label="Commission / Payout Note" placeholder="Optional agreed referral terms" className="sm:col-span-2" />
          <Field name="notes" label="Internal Notes" className="sm:col-span-2" />
          {error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={onClose} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-bold">Cancel</button>
            <button disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50"><UserRound size={16} />{loading ? "Creating" : "Create & select"}</button>
          </div>
        </form>
      </div>
    </div>
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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
      />
    </label>
  );
}

function Select({ label, name, options, labels }: { label: string; name: string; options: string[]; labels?: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
      >
        {options.map((option, index) => (
          <option key={option} value={option}>
            {labels?.[index] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanLimit({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <dt className="text-[10px] font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-slate-950">{value.toLocaleString("en-IN")}</dd>
    </div>
  );
}
