'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, Menu, MessageSquareText, Users, X } from 'lucide-react';
import { PROMPT_GROUPS } from '@/lib/prompt-registry';
import { groupSlug } from '@/lib/admin-prompt-groups';

type NavItem = {
  label: string;
  href: string;
  icon?: typeof Users;
};

type NavSection = {
  title?: string;
  icon?: typeof Users;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Prompts',
    icon: MessageSquareText,
    items: PROMPT_GROUPS.map((group) => ({
      label: group,
      href: `/admin/prompts/${groupSlug(group)}`,
    })),
  },
];

export default function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Top bar — visible on mobile only */}
      <div className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-2 -ml-2 rounded hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>
        <span className="font-semibold text-sm">Admin</span>
        <span className="text-xs text-gray-500 truncate max-w-[160px]">{userEmail}</span>
      </div>

      <div className="flex min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
        {/* Mobile backdrop */}
        {open ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          />
        ) : null}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:relative lg:translate-x-0 lg:transform-none lg:transition-none ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200">
            <span className="font-semibold text-sm">Admin</span>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="p-2 -mr-2 rounded hover:bg-gray-100 lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {NAV_SECTIONS.map((section, sectionIndex) => {
              const SectionIcon = section.icon;
              return (
                <div key={section.title ?? `section-${sectionIndex}`} className="space-y-0.5">
                  {section.title ? (
                    <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500">
                      {SectionIcon ? <SectionIcon size={16} strokeWidth={1.8} /> : null}
                      {section.title}
                    </div>
                  ) : null}
                  {section.items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const isNested = Boolean(section.title);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                          isNested ? 'pl-10' : ''
                        } ${
                          active
                            ? 'bg-gray-200 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-500 truncate hidden lg:block">
            {userEmail}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
