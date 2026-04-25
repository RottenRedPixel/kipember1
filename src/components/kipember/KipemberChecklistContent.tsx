'use client';

import {
  AlertTriangle,
  Clock,
  Heart,
  Lightbulb,
  ListChecks,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  Phone,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import type { KipemberWikiDetail } from '@/components/kipember/KipemberWikiContent';

type Channel = 'chat' | 'call';

type Person = {
  name: string;
  avatarUrl?: string | null;
  color: string;
};

type Entry = {
  value: string;
  source: Person;
  channel: Channel;
  at: string;
};

type Facet = {
  key: 'who' | 'what' | 'where' | 'when' | 'why';
  label: string;
  IconCmp: React.ComponentType<{ size?: number; className?: string; fill?: string; stroke?: string }>;
  color: string;
  singleValue: boolean;
  entries: Entry[];
};

type EmotionalRow = {
  person: Person;
  value: string | null;
  channel: Channel | null;
  at: string | null;
};

const PERSON_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#b45309', '#db2777', '#0891b2'];

function colorForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function relativeAt(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

function distinctCount(entries: Entry[]) {
  return new Set(entries.map((e) => e.value.trim().toLowerCase())).size;
}

function hasConflict(facet: Facet) {
  return facet.singleValue && distinctCount(facet.entries) >= 2;
}

function SourcePill({ entry }: { entry: Entry }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {entry.source.avatarUrl ? (
        <img
          src={entry.source.avatarUrl}
          alt={entry.source.name}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 18, height: 18 }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ width: 18, height: 18, background: entry.source.color, fontSize: 9, fontWeight: 600 }}
        >
          {initials(entry.source.name)}
        </div>
      )}
      <span className="text-white/60 text-[11px]">{entry.source.name.split(/\s+/)[0] || entry.source.name}</span>
      {entry.channel === 'chat' ? (
        <MessageCircle size={10} className="text-white/40" fill="currentColor" stroke="currentColor" />
      ) : (
        <Phone size={10} className="text-white/40" fill="currentColor" stroke="currentColor" />
      )}
      <span className="text-white/30 text-[10px]">· {relativeAt(entry.at)}</span>
    </div>
  );
}

function FacetCard({ facet }: { facet: Facet }) {
  const Icon = facet.IconCmp;
  const conflict = hasConflict(facet);
  const count = facet.entries.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--text-secondary)' }}>
          <Icon size={17} />
        </span>
        <h3 className="text-white font-medium text-base">{facet.label}</h3>
        {conflict ? (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.18)', color: '#f97316', border: '1px solid rgba(249,115,22,0.45)' }}>
            <AlertTriangle size={10} />
            conflict
          </span>
        ) : null}
        <span className="ml-auto text-white/30 text-[11px]">
          {count === 0 ? 'no answers' : count === 1 ? '1 entry' : `${count} entries`}
        </span>
      </div>

      {facet.entries.length === 0 ? (
        <p className="text-white/30 text-xs italic">No answers yet · ember will ask next conversation</p>
      ) : (
        <div className="flex flex-col gap-2">
          {facet.entries.map((entry, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              <p className="text-white/85 text-xs leading-relaxed">{entry.value}</p>
              <SourcePill entry={entry} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1 text-white/40 text-[11px] font-medium can-hover"
          style={{ minHeight: 28 }}
        >
          <Plus size={12} />
          Add
        </button>
        {conflict ? (
          <button
            type="button"
            className="ml-auto text-[11px] font-medium can-hover"
            style={{ color: '#f97316', minHeight: 28 }}
          >
            → Reconcile
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function KipemberChecklistContent({ detail }: { detail: KipemberWikiDetail | null }) {
  const blocks = detail?.chatBlocks ?? [];
  const personA: Person = blocks[0]
    ? { name: blocks[0].personName, avatarUrl: blocks[0].avatarUrl ?? null, color: colorForName(blocks[0].personName) }
    : { name: 'Owner', avatarUrl: null, color: PERSON_COLORS[0] };
  const personB: Person = blocks[1]
    ? { name: blocks[1].personName, avatarUrl: blocks[1].avatarUrl ?? null, color: colorForName(blocks[1].personName) }
    : { name: 'Sarah', avatarUrl: null, color: PERSON_COLORS[1] };
  const personC: Person = blocks[2]
    ? { name: blocks[2].personName, avatarUrl: blocks[2].avatarUrl ?? null, color: colorForName(blocks[2].personName) }
    : { name: 'Mom', avatarUrl: null, color: PERSON_COLORS[2] };

  const now = Date.now();
  const t = (mins: number) => new Date(now - mins * 60_000).toISOString();

  const facets: Facet[] = [
    {
      key: 'who', label: 'Who', IconCmp: Users, color: '#3b82f6', singleValue: false,
      entries: [
        { value: 'Sarah, Mike, baby Liam', source: personA, channel: 'chat', at: t(120) },
        { value: 'My sister Sarah and her kids', source: personC, channel: 'call', at: t(1440) },
      ],
    },
    {
      key: 'what', label: 'What', IconCmp: MessageSquareQuote, color: '#8b5cf6', singleValue: false,
      entries: [
        { value: 'First family dinner after the move', source: personA, channel: 'chat', at: t(120) },
      ],
    },
    {
      key: 'where', label: 'Where', IconCmp: MapPin, color: '#10b981', singleValue: true,
      entries: [
        { value: 'London', source: personA, channel: 'chat', at: t(120) },
        { value: 'Oxford', source: personB, channel: 'call', at: t(30) },
      ],
    },
    {
      key: 'when', label: 'When', IconCmp: Clock, color: '#f59e0b', singleValue: true,
      entries: [],
    },
    {
      key: 'why', label: 'Why', IconCmp: Lightbulb, color: '#ec4899', singleValue: false,
      entries: [
        { value: "We hadn't all been together since Christmas — the holidays were a blur", source: personC, channel: 'call', at: t(1440) },
      ],
    },
  ];

  const emotionalRows: EmotionalRow[] = [
    { person: personA, value: 'happy, relaxed, proud', channel: 'chat', at: t(120) },
    { person: personB, value: 'tired but joyful', channel: 'call', at: t(30) },
    { person: personC, value: null, channel: null, at: null },
  ];

  const stories: Entry[] = [
    { value: 'Liam laughed for the first time when his uncle made a face at him across the table.', source: personC, channel: 'call', at: t(1440) },
    { value: "Sarah brought her dog and the dog ate half the cake before anyone noticed.", source: personA, channel: 'chat', at: t(120) },
  ];

  const facetsAnswered = facets.filter((f) => f.entries.length > 0).length;
  const emotionalAnswered = emotionalRows.some((r) => r.value) ? 1 : 0;
  const storiesAnswered = stories.length > 0 ? 1 : 0;
  const totalCompleted = facetsAnswered + emotionalAnswered + storiesAnswered;
  const totalSlots = 7;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <ListChecks size={14} className="text-white/60" />
          <p className="text-white text-sm font-medium">5 + 2 progress</p>
          <span className="ml-auto text-white/40 text-xs">{totalCompleted} of {totalSlots} facets answered</span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full" style={{ width: `${(totalCompleted / totalSlots) * 100}%`, background: '#f97316' }} />
        </div>
        <p className="text-white/30 text-[11px] leading-relaxed">
          Every claim is preserved verbatim with its source. Conflicts are flagged here for the reconciliation engine — they are never silently merged.
        </p>
      </div>

      {facets.map((facet) => (
        <FacetCard key={facet.key} facet={facet} />
      ))}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>
            <Heart size={17} />
          </span>
          <h3 className="text-white font-medium text-base">Emotional state</h3>
          <span className="ml-auto text-white/30 text-[11px]">per tagged person</span>
        </div>
        <div className="flex flex-col gap-2">
          {emotionalRows.map((row, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2 flex items-center gap-2.5"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              {row.person.avatarUrl ? (
                <img src={row.person.avatarUrl} alt={row.person.name} className="rounded-full object-cover flex-shrink-0" style={{ width: 26, height: 26 }} />
              ) : (
                <div className="rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ width: 26, height: 26, background: row.person.color, fontSize: 10, fontWeight: 600 }}>
                  {initials(row.person.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium">{row.person.name.split(/\s+/)[0] || row.person.name}</p>
                {row.value ? (
                  <p className="text-white/60 text-[11px] mt-0.5">&ldquo;{row.value}&rdquo;</p>
                ) : (
                  <p className="text-white/25 text-[11px] mt-0.5 italic">no answer yet</p>
                )}
              </div>
              {row.value && row.channel ? (
                <div className="flex items-center gap-1 text-white/30 text-[10px] flex-shrink-0">
                  {row.channel === 'chat' ? (
                    <MessageCircle size={10} fill="currentColor" stroke="currentColor" />
                  ) : (
                    <Phone size={10} fill="currentColor" stroke="currentColor" />
                  )}
                  <span>{row.at ? relativeAt(row.at) : ''}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>
            <Sparkles size={17} />
          </span>
          <h3 className="text-white font-medium text-base">Extra stories</h3>
          <span className="ml-auto text-white/30 text-[11px]">
            {stories.length === 1 ? '1 entry' : `${stories.length} entries`}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {stories.map((entry, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
            >
              <p className="text-white/85 text-xs leading-relaxed">{entry.value}</p>
              <SourcePill entry={entry} />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-white/40 text-[11px] font-medium can-hover"
          style={{ minHeight: 28 }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      <p className="text-white/25 text-[10px] text-center italic mt-2 mb-4">
        Preview · placeholder data until the 5 + 2 extractor wires in
      </p>
    </div>
  );
}
