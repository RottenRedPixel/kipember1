"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: connect to auth — e.g. signIn(form.email, form.password)
    router.push("/home");
  }

  return (
    <div
      className="flex flex-col items-center justify-center w-full px-6"
      style={{ minHeight: "100dvh", background: "var(--bg-screen)" }}
    >
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "var(--bg-surface)" }}
        >
          <Home size={20} color="var(--text-primary)" strokeWidth={1.8} />
        </Link>
      </div>
      <div className="flex flex-col gap-8 w-full max-w-sm py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-white text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-white/60 text-sm">Sign in to continue to Ember.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
          <Field label="Password" name="password" type="password" placeholder="Your password" value={form.password} onChange={handleChange} />

          <div className="flex justify-end">
            {/* TODO: wire up forgot password flow */}
            <button type="button" className="text-white/30 text-xs hover:text-white/60 transition-colors">
              Forgot password?
            </button>
          </div>

          <Link
            href="/home"
            className="flex items-center justify-center rounded-full text-white text-sm font-medium transition-opacity hover:opacity-80 btn-primary"
            style={{ background: "#f97316", minHeight: 44 }}
          >
            Sign In
          </Link>
        </form>

        <p className="text-center text-white/60 text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-white font-medium hover:opacity-70 transition-opacity">
            Sign Up
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
