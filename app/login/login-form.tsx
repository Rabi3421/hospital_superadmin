"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, Mail, ShieldPlus } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/superadmin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.message ?? "Login failed");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md">
      <div className="mb-10">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#278b7c] text-white">
            <ShieldPlus size={23} />
          </span>
          <div>
            <p className="text-2xl font-bold leading-6 text-[#151918]">WeCare</p>
            <p className="mt-1 text-xs font-semibold text-[#7a8581]">Medical Admin Dashboard</p>
          </div>
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#278b7c]">Welcome back</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#151918]">Superadmin Login</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#7a8581]">
          Sign in to manage hospitals, subscriptions, tenant users, and platform controls.
        </p>
      </div>
      <label className="block text-sm font-bold text-[#394340]" htmlFor="email">
        Email address
      </label>
      <div className="mt-2 flex h-[52px] items-center gap-3 rounded-lg border border-[#dfe8e4] bg-[#fbfdfc] px-4 focus-within:border-[#278b7c]">
        <Mail size={18} className="text-[#8a9591]" />
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="admin@example.com"
          className="h-full w-full bg-transparent text-sm font-semibold text-[#151918] outline-none placeholder:text-[#9aa5a1]"
        />
      </div>
      <label className="mt-5 block text-sm font-bold text-[#394340]" htmlFor="password">
        Password
      </label>
      <div className="mt-2 flex h-[52px] items-center gap-3 rounded-lg border border-[#dfe8e4] bg-[#fbfdfc] px-4 focus-within:border-[#278b7c]">
        <LockKeyhole size={18} className="text-[#8a9591]" />
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="Enter password"
          className="h-full w-full bg-transparent text-sm font-semibold text-[#151918] outline-none placeholder:text-[#9aa5a1]"
        />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm font-semibold">
        <label className="flex items-center gap-2 text-[#687370]">
          <input type="checkbox" className="h-4 w-4 rounded border-[#cfd9d5] accent-[#278b7c]" />
          Remember me
        </label>
        <span className="text-[#278b7c]">Need help?</span>
      </div>
      {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#151918] px-4 text-sm font-bold text-white shadow-[0_18px_35px_rgba(21,25,24,0.18)] hover:bg-[#278b7c] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn size={18} />
        {loading ? "Signing in" : "Sign in"}
      </button>
      <p className="mt-8 text-center text-xs font-semibold leading-5 text-[#8a9591]">
        Protected with HTTP-only cookies and role-based platform access.
      </p>
    </form>
  );
}
