import { Bookmark, Share2, PlusCircle, User } from 'lucide-react';

export const USER_ACTIONS: Record<string, string> = {
  'my-embers': 'My Embers',
  'shared-embers': 'Shared Embers',
  'create-ember': 'Create Ember',
  profile: 'Profile',
};

export const USER_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>> = {
  'my-embers': Bookmark,
  'shared-embers': Share2,
  'create-ember': PlusCircle,
  profile: User,
};
