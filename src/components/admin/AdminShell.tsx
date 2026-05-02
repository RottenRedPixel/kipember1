'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, Menu, MessageSquareText, Users, X } from 'lucide-react';
import { PROMPT_GROUPS, PROMPT_REGISTRY } from '@/lib/prompt-registry';
import { groupSlug, shortPromptLabel } from '@/lib/admin-prompt-groups';

type NavItem = {
  label: string;
  href: string;
  icon?: typeof Users;
  children?: NavItem[];
};

type NavSection = {
  title?: string;
  icon?: typeof Users;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { label: 'Users', href: '/admin/users', icon: Users },
    ],
  },
  {
    title: 'Prompts',
    icon: MessageSquareText,
    items: PROMPT_GROUPS.map((group) => ({
      label: group,
      href: `/admin/prompts/${groupSlug(group)}`,
      children: PROMPT_REGISTRY.filter((p) => p.group === group).map((p) => ({
        label: shortPromptLabel(p.key),
        href: `/admin/prompts/${groupSlug(group)}/${encodeURIComponent(p.key)}`,
      })),
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
  // Groups collapsed by default. The set holds hrefs of currently expanded
  // groups. We auto-expand whichever group contains the active route on
  // navigation (so context is visible after a click), but don't force it —
  // the user can still collapse it after if they want.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        if (item.children?.length && pathname.startsWith(`${item.href}/`)) {
          setExpandedGroups((prev) => {
            if (prev.has(item.href)) return prev;
            const next = new Set(prev);
            next.add(item.href);
            return next;
          });
        }
      }
    }
  }, [pathname]);

  const toggleGroup = (href: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

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

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                    const hasChildren = Boolean(item.children && item.children.length > 0);
                    const isExpanded = hasChildren && expandedGroups.has(item.href);
                    return (
                      <div key={item.href}>
                        {hasChildren ? (
                          // Group header — toggles expand/collapse of its prompts.
                          <button
                            type="button"
                            onClick={() => toggleGroup(item.href)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 ${
                              isNested ? 'pl-10' : ''
                            }`}
                          >
                            {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown
                              size={14}
                              strokeWidth={2}
                              className={`text-gray-400 transition-transform ${
                                isExpanded ? '' : '-rotate-90'
                              }`}
                            />
                          </button>
                        ) : (
                          <Link
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
                        )}
                        {hasChildren && isExpanded ? (
                          <div className="space-y-0.5 mt-0.5">
                            {item.children!.map((child) => {
                              const childActive = pathname === child.href;
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className={`flex items-center gap-3 pl-14 pr-3 py-1.5 rounded-md text-xs font-normal ${
                                    childActive
                                      ? 'bg-gray-200 text-gray-900'
                                      : 'text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
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
