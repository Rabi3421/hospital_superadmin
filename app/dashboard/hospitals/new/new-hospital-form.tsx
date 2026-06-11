"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, X } from "lucide-react";

export default function NewHospitalForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

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
      registrationNumber: value("registrationNumber"),
      gstNumber: value("gstNumber"),
      logoUrl: value("logoUrl"),
      subscriptionPlan: value("subscriptionPlan"),
      monthlyPrice: value("monthlyPrice"),
      trialDays: value("trialDays"),
      maxDoctors: value("maxDoctors"),
      maxStaff: value("maxStaff"),
      maxPatients: value("maxPatients"),
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

          <Section title="Registration and branding" description="Optional public and compliance information.">
            <Field name="registrationNumber" label="Registration Number" />
            <Field name="gstNumber" label="GST Number" />
            <Field name="logoUrl" label="Logo URL" className="md:col-span-2" />
          </Section>
        </div>

        <aside className="h-fit rounded-lg border border-[#edf2ef] bg-[#f8fbfa] p-4">
          <p className="text-sm font-bold text-slate-950">Plan and limits</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Set the starting subscription, price, trial window, and operating limits.</p>
          <div className="mt-5 grid gap-4">
            <Field name="subscriptionPlan" label="Subscription Plan" defaultValue="Trial" required />
            <Field name="monthlyPrice" label="Monthly Price" type="number" defaultValue="0" />
            <Field name="trialDays" label="Trial Days" type="number" defaultValue="30" />
            <Field name="maxDoctors" label="Max Doctors" type="number" defaultValue="5" />
            <Field name="maxStaff" label="Max Staff" type="number" defaultValue="20" />
            <Field name="maxPatients" label="Max Patients" type="number" defaultValue="1000" />
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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
      />
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
