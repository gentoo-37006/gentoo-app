import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Lets container components (e.g. Button) set the default text styling for any
 * <Text> rendered inside them, mirroring the React Native Reusables pattern.
 */
export const TextClassContext = React.createContext<string | undefined>(undefined);

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: 'text-base',
      h1: 'text-3xl font-extrabold tracking-tight',
      h2: 'text-2xl font-bold tracking-tight',
      h3: 'text-xl font-semibold tracking-tight',
      title: 'text-lg font-semibold',
      large: 'text-lg font-medium',
      body: 'text-base',
      muted: 'text-sm text-muted-foreground',
      small: 'text-xs text-muted-foreground',
      label: 'text-xs font-semibold uppercase tracking-wider',
      lead: 'text-base text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type TextProps = React.ComponentProps<typeof RNText> &
  VariantProps<typeof textVariants>;

export function Text({ className, variant, ...props }: TextProps) {
  const contextClass = React.useContext(TextClassContext);
  return (
    <RNText
      className={cn(textVariants({ variant }), contextClass, className)}
      {...props}
    />
  );
}

export { textVariants };
