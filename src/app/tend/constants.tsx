import { PlusCircle, BookOpen, ScanEye, Tag, PencilLine, Users, Settings } from 'lucide-react';

export const TEND_ACTIONS: Record<string, string> = {
  'add-content': 'Add Content',
  'view-wiki': 'View Wiki',
  'edit-snapshot': 'Edit Snapshot',
  'tag-people': 'Tag People',
  'edit-title': 'Edit Title',
  contributors: 'Contributors',
  settings: 'Settings',
};

export const TEND_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>> = {
  'add-content': PlusCircle,
  'view-wiki': BookOpen,
  'edit-snapshot': ScanEye,
  'tag-people': Tag,
  'edit-title': PencilLine,
  contributors: Users,
  settings: Settings,
};
