import { Leaf, ScanEye, UserStar, PencilLine, Users, Clock } from 'lucide-react';

// Frame is intentionally absent from the modal but FrameSlider still
// renders at /tend/frame so we can route there programmatically when we
// re-add the feature.

export const TEND_ACTIONS: Record<string, string> = {
  // 'view-wiki' is the umbrella surface — every wiki section's pencil
  // routes back here. The header reflects that broader role.
  'view-wiki': 'Tend this Ember',
  'edit-snapshot': 'Edit Snapshot',
  'tag-people': 'Tag People',
  'edit-title': 'Edit Title',
  'edit-time-place': 'Edit Time & Place',
  contributors: 'Contributors',
};

export const TEND_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>> = {
  'view-wiki': Leaf,
  'edit-snapshot': ScanEye,
  'tag-people': UserStar,
  'edit-title': PencilLine,
  'edit-time-place': Clock,
  contributors: Users,
};
