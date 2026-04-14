"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: connect to auth/db — e.g. createUser(form.name, form.email, form.password)
    router.push("/home?mode=first-ember");
  }

  return (
    <div
      className="flex flex-col items-center justify-center w-full px-6"
      style={{ minHeight: "100dvh", background: "var(--bg-screen)" }}
    >
      <div className="flex flex-col gap-8 w-full max-w-sm py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-white/60 text-sm">Start preserving your memories with Ember.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name" name="name" type="text" placeholder="Your name" value={form.name} onChange={handleChange} />
          <Field label="Email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
          <Field label="Password" name="password" type="password" placeholder="Create a password" value={form.password} onChange={handleChange} />

          <button
            type="submit"
            className="mt-2 flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 w-full btn-primary"
            style={{ background: "#f97316", minHeight: 44 }}
          >
            Sign Up
          </button>
        </form>

        <p className="text-center text-white/60 text-sm">
          Already have an account?{" "}
          <Link href="/signin" className="text-white font-medium hover:opacity-70 transition-opacity">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, name, type, placeholder, value, onChange,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/60 text-xs font-medium">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="h-12 rounded-xl px-4 text-sm text-white placeholder-white/30 outline-none transition-colors"
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-input)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(249,115,22,0.6)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-input)")}
      />
    </div>
  );
}
