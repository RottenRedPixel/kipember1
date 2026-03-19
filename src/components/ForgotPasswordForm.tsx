'use client';

import { useState } from 'react';
import EmberBrand from '@/components/EmberBrand';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send reset link');
      }

      setSuccess(payload.message || 'If that email is in Ember, a reset link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ember-panel-strong w-full max-w-md rounded-[2rem] p-8">
      <EmberBrand subtitle="password reset" compact />
      <h1 className="ember-heading mt-6 text-4xl text-[var(--ember-text)]">
        Reset your password
      </h1>
      <p className="ember-copy mt-3 text-sm">
        Enter your email and Ember will send you a secure password reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--ember-text)]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            className="ember-input"
          />
        </div>

        {(error || success) && (
          <div
            className={`ember-status ${error ? 'ember-status-error' : 'ember-status-success'}`}
          >
            {error || success}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="ember-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending reset link...' : 'Email reset link'}
        </button>
      </form>
    </div>
  );
}
