"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { USER_ACTIONS, USER_ICONS } from "../constants";

// ── Mock ember data ────────────────────────────────────────────────────────
const MY_EMBERS = [
  { id: "1",  title: "Beach Day",         date: "Summer 2023"    },
  { id: "2",  title: "First Birthday",    date: "March 2022"     },
  { id: "3",  title: "Thanksgiving 2023", date: "November 2023"  },
  { id: "4",  title: "Graduation Day",    date: "May 2023"       },
  { id: "5",  title: "Road Trip",         date: "July 2023"      },
  { id: "6",  title: "Christmas Morning", date: "December 2023"  },
  { id: "7",  title: "Weekend Hike",      date: "September 2023" },
  { id: "8",  title: "Dad's 60th",        date: "April 2023"     },
  { id: "9",  title: "New Year's Eve",    date: "January 2024"   },
  { id: "10", title: "Summer BBQ",        date: "August 2023"    },
  { id: "11", title: "School Play",       date: "October 2023"   },
  { id: "12", title: "Mom's Garden",      date: "June 2023"      },
  { id: "13", title: "Lake House",        date: "July 2022"      },
  { id: "14", title: "Soccer Finals",     date: "May 2022"       },
  { id: "15", title: "Winter Break",      date: "December 2022"  },
  { id: "16", title: "Grandma's 80th",    date: "August 2022"    },
  { id: "17", title: "Spring Picnic",     date: "April 2022"     },
  { id: "18", title: "Halloween 2022",    date: "October 2022"   },
  { id: "19", title: "Camping Trip",      date: "June 2022"      },
  { id: "20", title: "First Day of School", date: "September 2022" },
  { id: "21", title: "Family Reunion",    date: "July 2021"      },
  { id: "22", title: "Anniversary Dinner",date: "February 2023"  },
  { id: "23", title: "Baby Shower",       date: "January 2022"   },
  { id: "24", title: "Ski Weekend",       date: "February 2022"  },
];

const SHARED_EMBERS = MY_EMBERS.slice(0, 6).map(e => ({ ...e, owner: "Seth Tropper" }));

const SORT_OPTIONS = ["Newest", "Oldest", "A–Z", "Z–A"];

// ── Ember Grid ─────────────────────────────────────────────────────────────
function EmberGallery({ embers, action }: { embers: typeof MY_EMBERS; action: string }) {
  const params = useSearchParams();
  const sort = params.get("sort") ?? "Newest";
  const showSort = params.get("sort-open") === "1";

  const sorted = [...embers].sort((a, b) => {
    if (sort === "A–Z") return a.title.localeCompare(b.title);
    if (sort === "Z–A") return b.title.localeCompare(a.title);
    if (sort === "Oldest") return parseInt(a.id) - parseInt(b.id);
    return parseInt(b.id) - parseInt(a.id); // Newest
  });

  const base = `/user/${action}`;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end py-3 flex-shrink-0">
        <div className="relative">
          <Link
            href={`${base}?sort=${sort}&sort-open=${showSort ? "0" : "1"}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl can-hover"
            style={{ background: "var(--bg-surface)", opacity: 0.9 }}
          >
            <span className="text-white text-xs font-medium">{sort}</span>
            <ChevronDown size={13} color="var(--text-secondary)" strokeWidth={2} />
          </Link>
          {showSort && (
            <div
              className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden z-10 flex flex-col"
              style={{ background: "var(--bg-screen)", border: "1px solid var(--border-default)", minWidth: 110 }}
            >
              {SORT_OPTIONS.map(opt => (
                <Link
                  key={opt}
                  href={`${base}?sort=${encodeURIComponent(opt)}&sort-open=0`}
                  className="px-4 py-2.5 text-xs font-medium can-hover"
                  style={{ color: opt === sort ? "#f97316" : "var(--text-primary)", opacity: 0.9 }}
                >
                  {opt}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-6 no-scrollbar">
        <div className="grid grid-cols-3 gap-1.5">
          {sorted.map(e => (
            <Link key={e.id} href="/home" className="aspect-square rounded-xl overflow-hidden can-hover" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", opacity: 0.95 }}>
              <div className="w-full h-full" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function UserActionPage({
  params,
}: {
  params: Promise<{ action: string }>;
}) {
  const { action } = use(params);
  const title = USER_ACTIONS[action];

  if (!title) return null;

  const isEmberList = action === "my-embers" || action === "shared-embers";
  const embers = action === "shared-embers" ? SHARED_EMBERS : MY_EMBERS;

  return (
    <div className="fixed inset-0 flex">
      {/* 7% peek — tap to go back */}
      <Link href="/home" className="w-[7%] h-full" />

      {/* 93% panel */}
      <div
        className="w-[93%] h-full flex flex-col slide-in-right"
        style={{ background: "var(--bg-screen)", borderLeft: "1px solid var(--border-subtle)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Link
            href="/home"
            className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-full can-hover"
            style={{ opacity: 0.75 }}
          >
            <ChevronLeft size={22} color="var(--text-primary)" strokeWidth={1.8} />
          </Link>

          {USER_ICONS[action] && (
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              {USER_ICONS[action]}
            </svg>
          )}

          <h2 className="text-white font-medium text-base">{title}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 min-h-0 flex flex-col">
          {isEmberList
            ? <EmberGallery embers={embers} action={action} />
            : <div className="pt-6 text-white/30 text-sm">{/* placeholder */}</div>
          }
        </div>
      </div>
    </div>
  );
}
