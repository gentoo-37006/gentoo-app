import * as React from 'react';
import { cssInterop } from 'nativewind';
import type { LucideIcon, LucideProps } from 'lucide-react-native';

export type IconProps = LucideProps & { as: LucideIcon };

function IconImpl({ as: LucideComponent, ...props }: IconProps) {
  return <LucideComponent {...props} />;
}

// Allow lucide icons to be colored/sized via NativeWind className (e.g.
// `text-primary`, `text-muted-foreground`). The resolved `color` style value is
// forwarded to lucide's `color` prop (which drives stroke), the rest as style.
cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true, opacity: true },
  },
});

/**
 * Themed icon wrapper. Usage: <Icon as={Bell} className="text-primary" size={20} />
 */
export function Icon({ size = 20, ...props }: IconProps) {
  return <IconImpl size={size} {...props} />;
}
