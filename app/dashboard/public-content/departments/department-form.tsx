"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function DepartmentForm({ hospitals }: { hospitals: { hospitalId: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/superadmin/public-content/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.message ?? "Unable to save department");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!hospitals.length} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-40"><Plus size={16} />Add Department</button>
      {open ? (
        <Dialog title="Add Department" onClose={() => setOpen(false)}>
          <form onSubmit={createDepartment} className="grid gap-4 sm:grid-cols-2">
            <Select name="hospitalId" label="Hospital" options={hospitals.map((hospital) => [hospital.hospitalId, hospital.name])} />
            <Field name="name" label="Department Name" required />
            <Field name="icon" label="Icon" />
            <Select name="status" label="Status" options={[["Active", "Active"], ["Inactive", "Inactive"]]} />
            <Field name="description" label="Description" className="sm:col-span-2" />
            {error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
            <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button><button disabled={loading} className="h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? "Saving" : "Create Department"}</button></div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}><div className="w-full max-w-xl rounded-lg bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} title="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4]"><X size={17} /></button></div><div className="p-5">{children}</div></div></div>;
}
function Field({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  return <label className={className}><span className="text-sm font-bold text-[#394340]">{label}</span><input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" /></label>;
}
function Select({ label, name, options }: { label: string; name: string; options: string[][] }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><select name={name} required className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}
