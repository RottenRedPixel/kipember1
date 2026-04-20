import { PlusCircle, BookOpen, ScanEye, UserStar, PencilLine, Users, Settings, Clock, MapPin } from 'lucide-react';

export const TEND_ACTIONS: Record<string, string> = {
  'add-content': 'Add Content',
  'view-wiki': 'View Wiki',
  'edit-snapshot': 'Edit Snapshot',
  'tag-people': 'Tag People',
  'edit-title': 'Edit Title',
  'edit-time-date': 'Edit Time & Date',
  'edit-location': 'Edit Location',
  contributors: 'Contributors',
  settings: 'Settings',
};

export const TEND_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>> = {
  'add-content': PlusCircle,
  'view-wiki': BookOpen,
  'edit-snapshot': ScanEye,
  'tag-people': UserStar,
  'edit-title': PencilLine,
  'edit-time-date': Clock,
  'edit-location': MapPin,
  contributors: Users,
  settings: Settings,
};
