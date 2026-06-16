"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, UserPlus, UsersRound, X } from "lucide-react";
import { EmptyState, StatusBadge } from "../components/dashboard-ui";

type HospitalOption = { hospitalId: string; name: string };
type HospitalUserRow = {
  _id: string;
  hospitalId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
};

const roles = ["HOSPITAL_ADMIN", "MANAGING_DIRECTOR", "RECEPTIONIST", "DOCTOR", "NURSE", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT", "PATIENT"];

export default function HospitalUserManager({ hospitals, users }: { hospitals: HospitalOption[]; users: HospitalUserRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hospitalMap = useMemo(() => new Map(hospitals.map((hospital) => [hospital.hospitalId, hospital.name])), [hospitals]);
  const filtered = users.filter((user) => {
    const term = search.toLowerCase();
    return (!term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term) || user.hospitalId.toLowerCase().includes(term)) && (!role || user.role === role);
  });

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/superadmin/hospital-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.message ?? "Unable to create user");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 shadow-[0_12px_32px_rgba(32,45,39,0.04)] md:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[#dfe8e4] px-3">
          <Search size={16} className="text-[#8a9591]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, email, or hospital ID" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="h-10 rounded-md border border-[#dfe8e4] bg-white px-3 text-sm font-semibold">
          <option value="">All roles</option>
          {roles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(true)} disabled={hospitals.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-40">
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
        {filtered.length ? (
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]">
              <tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Hospital</th><th className="px-5 py-4">Phone</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ef]">
              {filtered.map((user) => (
                <tr key={user._id} className="hover:bg-[#fbfdfc]">
                  <td className="px-5 py-4"><p className="font-bold text-[#151918]">{user.name}</p><p className="mt-1 text-xs font-semibold text-[#8a9591]">{user.email}</p></td>
                  <td className="px-5 py-4"><p className="font-semibold text-[#394340]">{hospitalMap.get(user.hospitalId) ?? user.hospitalId}</p><p className="mt-1 text-xs text-[#8a9591]">{user.hospitalId}</p></td>
                  <td className="px-5 py-4 font-semibold text-[#394340]">{user.phone}</td>
                  <td className="px-5 py-4"><span className="rounded-md bg-[#f3f7f5] px-2.5 py-1.5 text-xs font-bold text-[#687370]">{user.role.replaceAll("_", " ")}</span></td>
                  <td className="px-5 py-4"><StatusBadge value={user.status} /></td>
                  <td className="px-5 py-4 text-right"><Link href={`/dashboard/hospitals/${user.hospitalId}`} title="View hospital" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] text-[#394340] hover:bg-[#edf8f3] hover:text-[#278b7c]"><Building2 size={16} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={UsersRound} title="No users found" description="Adjust the filters or create the first hospital user." action={<button onClick={() => setOpen(true)} className="rounded-md bg-[#278b7c] px-4 py-2 text-sm font-bold text-white">Add User</button>} />
        )}
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-lg border border-[#e2eae6] bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4">
              <div><h2 className="text-lg font-bold text-[#151918]">Add Hospital User</h2><p className="mt-1 text-xs font-semibold text-[#8a9591]">Permissions are assigned automatically from the selected role.</p></div>
              <button type="button" onClick={() => setOpen(false)} title="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] hover:bg-[#f3f7f5]"><X size={17} /></button>
            </div>
            <form onSubmit={createUser} className="grid gap-4 p-5 sm:grid-cols-2">
              <Select name="hospitalId" label="Hospital" options={hospitals.map((hospital) => [hospital.hospitalId, `${hospital.name} (${hospital.hospitalId})`])} />
              <Field name="name" label="Full Name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone" required />
              <Field name="password" label="Temporary Password" type="password" minLength={8} required />
              <Select name="role" label="Role" options={roles.map((item) => [item, item.replaceAll("_", " ")])} />
              {error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button>
                <button disabled={loading} className="h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? "Creating" : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><input {...props} className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm outline-none focus:border-[#278b7c]" /></label>;
}

function Select({ label, name, options }: { label: string; name: string; options: string[][] }) {
  return <label><span className="text-sm font-bold text-[#394340]">{label}</span><select name={name} required className="mt-2 h-10 w-full rounded-md border border-[#dfe8e4] px-3 text-sm">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}
