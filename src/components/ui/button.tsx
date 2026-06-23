import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90',
        secondary: 'bg-secondary active:opacity-80',
        destructive: 'bg-destructive active:opacity-90',
        success: 'bg-success active:opacity-90',
        outline: 'border border-border bg-transparent active:bg-accent',
        ghost: 'bg-transparent active:bg-accent',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3.5',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const buttonTextVariants = cva('text-sm font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      success: 'text-success-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type ButtonProps = Omit<React.ComponentProps<typeof Pressable>, 'children'> &
  VariantProps<typeof buttonVariants> & {
    label?: string;
    icon?: LucideIcon;
    loading?: boolean;
    className?: string;
    children?: React.ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  label,
  icon,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const textClass = buttonTextVariants({ variant });
  const isDisabled = disabled || loading;
  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50',
          className
        )}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" className={textClass} />
        ) : (
          icon && <Icon as={icon} size={18} className={textClass} />
        )}
        {label ? <Text className={textClass}>{label}</Text> : children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { buttonVariants, buttonTextVariants };
