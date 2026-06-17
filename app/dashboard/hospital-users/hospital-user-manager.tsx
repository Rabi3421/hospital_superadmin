"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, Trash2, UserPlus, UsersRound, X } from "lucide-react";
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
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // single-delete
  const [deleteTarget, setDeleteTarget] = useState<HospitalUserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");

  const selectAllRef = useRef<HTMLInputElement>(null);

  const hospitalMap = useMemo(() => new Map(hospitals.map((h) => [h.hospitalId, h.name])), [hospitals]);

  const filtered = useMemo(() => users.filter((user) => {
    const term = search.toLowerCase();
    return (
      (!term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term) || user.hospitalId.toLowerCase().includes(term)) &&
      (!role || user.role === role) &&
      (!hospitalFilter || user.hospitalId === hospitalFilter)
    );
  }), [users, search, role, hospitalFilter]);

  const filteredIds = useMemo(() => filtered.map((u) => u._id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));
  const selectedInView = filteredIds.filter((id) => selected.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  // clear selection when filters change
  useEffect(() => { setSelected(new Set()); }, [search, role, hospitalFilter]);

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); filteredIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

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
    if (!response.ok) { setError(result.message ?? "Unable to create user"); return; }
    setOpen(false);
    router.refresh();
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError("");
    const response = await fetch(`/api/superadmin/hospital-users/${deleteTarget._id}`, { method: "DELETE" });
    const result = await response.json();
    setDeleteLoading(false);
    if (!response.ok) { setDeleteError(result.message ?? "Unable to delete user"); return; }
    setDeleteTarget(null);
    setSelected((prev) => { const next = new Set(prev); next.delete(deleteTarget._id); return next; });
    router.refresh();
  }

  async function bulkDelete() {
    setBulkLoading(true);
    setBulkError("");
    const ids = [...selected];
    const response = await fetch("/api/superadmin/hospital-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const result = await response.json();
    setBulkLoading(false);
    if (!response.ok) { setBulkError(result.message ?? "Unable to delete users"); return; }
    setSelected(new Set());
    setBulkDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      {/* filters + add */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#e2eae6] bg-white p-4 shadow-[0_12px_32px_rgba(32,45,39,0.04)] md:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-[#dfe8e4] px-3">
          <Search size={16} className="text-[#8a9591]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, email, or hospital ID" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)} className="h-10 rounded-md border border-[#dfe8e4] bg-white px-3 text-sm font-semibold">
          <option value="">All hospitals</option>
          {hospitals.map((h) => <option key={h.hospitalId} value={h.hospitalId}>{h.name}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 rounded-md border border-[#dfe8e4] bg-white px-3 text-sm font-semibold">
          <option value="">All roles</option>
          {roles.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(true)} disabled={hospitals.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white hover:bg-[#1f7b6f] disabled:opacity-40">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {/* bulk action bar */}
      {selectedInView.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-red-700">{selectedInView.length} user{selectedInView.length > 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-[#8a9591] hover:text-[#394340]">Clear</button>
            <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">
              <Trash2 size={13} /> Delete selected
            </button>
          </div>
        </div>
      )}

      {/* table */}
      <section className="overflow-x-auto rounded-lg border border-[#e2eae6] bg-white shadow-[0_12px_32px_rgba(32,45,39,0.04)]">
        {filtered.length ? (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#edf2ef] bg-[#f8faf9] text-[11px] font-bold uppercase text-[#8a9591]">
              <tr>
                <th className="w-10 px-4 py-4">
                  <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer rounded border-[#dfe8e4] accent-[#278b7c]" />
                </th>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Hospital</th>
                <th className="px-5 py-4">Phone</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2ef]">
              {filtered.map((user) => {
                const isSelected = selected.has(user._id);
                return (
                  <tr key={user._id} className={isSelected ? "bg-red-50/60" : "hover:bg-[#fbfdfc]"}>
                    <td className="w-10 px-4 py-4">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(user._id)} className="h-4 w-4 cursor-pointer rounded border-[#dfe8e4] accent-[#278b7c]" />
                    </td>
                    <td className="px-5 py-4"><p className="font-bold text-[#151918]">{user.name}</p><p className="mt-1 text-xs font-semibold text-[#8a9591]">{user.email}</p></td>
                    <td className="px-5 py-4"><p className="font-semibold text-[#394340]">{hospitalMap.get(user.hospitalId) ?? user.hospitalId}</p><p className="mt-1 text-xs text-[#8a9591]">{user.hospitalId}</p></td>
                    <td className="px-5 py-4 font-semibold text-[#394340]">{user.phone}</td>
                    <td className="px-5 py-4"><span className="rounded-md bg-[#f3f7f5] px-2.5 py-1.5 text-xs font-bold text-[#687370]">{user.role.replaceAll("_", " ")}</span></td>
                    <td className="px-5 py-4"><StatusBadge value={user.status} /></td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link href={`/dashboard/hospitals/${user.hospitalId}`} title="View hospital" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] text-[#394340] hover:bg-[#edf8f3] hover:text-[#278b7c]"><Building2 size={16} /></Link>
                        <button type="button" title="Delete user" onClick={() => setDeleteTarget(user)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] text-[#394340] hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={UsersRound} title="No users found" description="Adjust the filters or create the first hospital user." action={<button onClick={() => setOpen(true)} className="rounded-md bg-[#278b7c] px-4 py-2 text-sm font-bold text-white">Add User</button>} />
        )}
      </section>

      {/* add user modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-lg border border-[#e2eae6] bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4">
              <div><h2 className="text-lg font-bold text-[#151918]">Add Hospital User</h2><p className="mt-1 text-xs font-semibold text-[#8a9591]">Permissions are assigned automatically from the selected role.</p></div>
              <button type="button" onClick={() => setOpen(false)} title="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] hover:bg-[#f3f7f5]"><X size={17} /></button>
            </div>
            <form onSubmit={createUser} className="grid gap-4 p-5 sm:grid-cols-2">
              <Select name="hospitalId" label="Hospital" options={hospitals.map((h) => [h.hospitalId, `${h.name} (${h.hospitalId})`])} />
              <Field name="name" label="Full Name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone" required />
              <Field name="password" label="Temporary Password" type="password" minLength={8} required />
              <Select name="role" label="Role" options={roles.map((item) => [item, item.replaceAll("_", " ")])} />
              {error ? <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p> : null}
              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button>
                <button disabled={loading} className="h-10 rounded-md bg-[#278b7c] px-4 text-sm font-bold text-white disabled:opacity-50">{loading ? "Creating…" : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* single delete modal */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={() => { setDeleteTarget(null); setDeleteError(""); }}>
          <div className="w-full max-w-md rounded-lg border border-[#e2eae6] bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4">
              <div><h2 className="text-lg font-bold text-[#151918]">Delete User</h2><p className="mt-1 text-xs font-semibold text-[#8a9591]">This action cannot be undone.</p></div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(""); }} title="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] hover:bg-[#f3f7f5]"><X size={17} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#394340]">Are you sure you want to delete <span className="font-bold text-[#151918]">{deleteTarget.name}</span> ({deleteTarget.email})?</p>
              <p className="mt-1 text-xs text-[#8a9591]">Hospital: {hospitalMap.get(deleteTarget.hospitalId) ?? deleteTarget.hospitalId} &middot; Role: {deleteTarget.role.replaceAll("_", " ")}</p>
              {deleteError ? <p className="mt-3 text-sm font-semibold text-red-600">{deleteError}</p> : null}
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(""); }} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button>
                <button type="button" onClick={deleteUser} disabled={deleteLoading} className="h-10 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{deleteLoading ? "Deleting…" : "Delete User"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* bulk delete modal */}
      {bulkDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151918]/40 p-4 backdrop-blur-[2px]" onMouseDown={() => { setBulkDeleteOpen(false); setBulkError(""); }}>
          <div className="w-full max-w-md rounded-lg border border-[#e2eae6] bg-white shadow-[0_28px_80px_rgba(21,25,24,0.25)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#edf2ef] px-5 py-4">
              <div><h2 className="text-lg font-bold text-[#151918]">Delete {selected.size} User{selected.size > 1 ? "s" : ""}</h2><p className="mt-1 text-xs font-semibold text-[#8a9591]">This action cannot be undone.</p></div>
              <button type="button" onClick={() => { setBulkDeleteOpen(false); setBulkError(""); }} title="Close" className="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe8e4] hover:bg-[#f3f7f5]"><X size={17} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#394340]">You are about to permanently delete <span className="font-bold text-[#151918]">{selected.size} user{selected.size > 1 ? "s" : ""}</span>. All their data will be removed.</p>
              {bulkError ? <p className="mt-3 text-sm font-semibold text-red-600">{bulkError}</p> : null}
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => { setBulkDeleteOpen(false); setBulkError(""); }} className="h-10 rounded-md border border-[#dfe8e4] px-4 text-sm font-bold">Cancel</button>
                <button type="button" onClick={bulkDelete} disabled={bulkLoading} className="h-10 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{bulkLoading ? "Deleting…" : `Delete ${selected.size} User${selected.size > 1 ? "s" : ""}`}</button>
              </div>
            </div>
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
