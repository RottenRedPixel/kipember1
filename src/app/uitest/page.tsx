'use client';
import { useState } from 'react';

const tokens = [
  { name: '--bg-body', label: 'bg-body' },
  { name: '--bg-screen', label: 'bg-screen' },
  { name: '--bg-surface', label: 'bg-surface' },
  { name: '--bg-modal', label: 'bg-modal' },
  { name: '--bg-input', label: 'bg-input' },
  { name: '--bg-chat-user', label: 'bg-chat-user' },
  { name: '--bg-ember-bubble', label: 'bg-ember-bubble' },
  { name: '--border-subtle', label: 'border-subtle' },
  { name: '--border-default', label: 'border-default' },
  { name: '--border-input', label: 'border-input' },
  { name: '--border-btn', label: 'border-btn' },
  { name: '--border-ember', label: 'border-ember' },
  { name: '--text-primary', label: 'text-primary' },
  { name: '--text-secondary', label: 'text-secondary' },
  { name: '--text-muted', label: 'text-muted' },
];

// Surface color matrix
// current = what the code actually uses today
// proposed = what it should become (tokens to define)
const surfaces = [
  {
    label: 'Chat',
    accent: '#f97316',
    rows: [
      { prop: 'Button',       current: '#f97316',                  hex: '#f97316' },
      { prop: 'User bubble',  current: '#f9731633',                hex: '#f9731633' },
      { prop: 'Ember bubble', current: '#2a2828',                  hex: '#2a2828' },
      { prop: 'Text/accent',  current: '#f97316',                  hex: '#f97316' },
      { prop: 'Border',       current: 'rgba(249,115,22,0.50)',    hex: 'rgba(249,115,22,0.50)' },
    ],
  },
  {
    label: 'Voice',
    accent: '#22c55e',
    rows: [
      { prop: 'Button',       current: '#22c55e',                  hex: '#22c55e' },
      { prop: 'User bubble',  current: '#22c55e2e',                hex: '#22c55e2e' },
      { prop: 'Ember bubble', current: '#2a2828',                  hex: '#2a2828' },
      { prop: 'Text/accent',  current: '#22c55e',                  hex: '#22c55e' },
      { prop: 'Border',       current: 'rgba(255,255,255,0.1)',    hex: 'rgba(255,255,255,0.1)' },
    ],
  },
  {
    label: 'Call',
    accent: '#2563eb',
    rows: [
      { prop: 'Button',       current: '#2563eb',                  hex: '#2563eb' },
      { prop: 'User bubble',  current: '#2563eb2e',                hex: '#2563eb2e' },
      { prop: 'Ember bubble', current: '#2a2828',                  hex: '#2a2828' },
      { prop: 'Text/accent',  current: '#60a5fa',                  hex: '#60a5fa' },
      { prop: 'Border',       current: 'rgba(37,99,235,0.45)',     hex: 'rgba(37,99,235,0.45)' },
    ],
  },
  {
    label: 'SMS',
    accent: '#5b21b6',
    rows: [
      { prop: 'Button',       current: '— future —',            hex: '#5b21b6' },
      { prop: 'User bubble',  current: '— future —',            hex: '#5b21b62e' },
      { prop: 'Ember bubble', current: '#2a2828',                hex: '#2a2828' },
      { prop: 'Text/accent',  current: '— future —',            hex: '#5b21b6' },
      { prop: 'Border',       current: '— future —',            hex: 'rgba(255,255,255,0.1)' },
    ],
  },
];

const PROPS = ['Button', 'User bubble', 'Ember bubble', 'Text/accent', 'Border'];

export default function UITestPage() {
  const [dark, setDark] = useState(true);

  return (
    <div
      data-theme={dark ? undefined : 'light'}
      style={{ minHeight: '100dvh', background: 'var(--bg-body)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}
    >
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
        <button onClick={() => setDark(false)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: !dark ? '#f97316' : 'var(--bg-input)', color: !dark ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>Light</button>
        <button onClick={() => setDark(true)}  style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', background:  dark ? '#f97316' : 'var(--bg-input)', color:  dark ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>Dark</button>
      </div>

      {/* Surface color matrix */}
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 24 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Surface Color Matrix</p>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
          <div />
          {surfaces.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rows */}
        {PROPS.map((prop) => (
          <div key={prop} style={{ display: 'grid', gridTemplateColumns: '100px repeat(4, 1fr)', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{prop}</p>
            {surfaces.map((s) => {
              const row = s.rows.find((r) => r.prop === prop)!;
              const isFuture = row.current.startsWith('—');
              return (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: '100%', height: 28, borderRadius: 6,
                    background: row.hex,
                    border: isFuture ? '1px dashed var(--border-default)' : '1px solid var(--border-subtle)',
                    opacity: isFuture ? 0.5 : 1,
                  }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 9, margin: 0, textAlign: 'center' }}>
                    {row.hex}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Token list */}
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 24 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Design Tokens</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tokens.map(({ name, label }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: `var(${name})`, border: '1px solid var(--border-default)' }} />
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, margin: 0 }}>{label}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>{name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
