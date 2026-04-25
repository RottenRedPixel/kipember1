import { PlusCircle, BookOpen, ScanEye, UserStar, PencilLine, Users, Settings, Clock, ScanLine, ListChecks } from 'lucide-react';

export const TEND_ACTIONS: Record<string, string> = {
  'add-content': 'Add Content',
  'view-wiki': 'View Wiki',
  checklist: 'Checklist',
  'edit-snapshot': 'Edit Snapshot',
  'tag-people': 'Tag People',
  'edit-title': 'Edit Title',
  'edit-time-place': 'Edit Time & Place',
  frame: 'Frame',
  contributors: 'Contributors',
  settings: 'Settings',
};

export const TEND_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>> = {
  'add-content': PlusCircle,
  'view-wiki': BookOpen,
  checklist: ListChecks,
  'edit-snapshot': ScanEye,
  'tag-people': UserStar,
  'edit-title': PencilLine,
  'edit-time-place': Clock,
  frame: ScanLine,
  contributors: Users,
  settings: Settings,
};
