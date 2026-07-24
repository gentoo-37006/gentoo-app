import * as React from 'react';
import { View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from '@/components/ui/text';

const badgeVariants = cva(
  'flex-row items-center self-start rounded-sm px-2 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-secondary',
        destructive: 'bg-destructive',
        success: 'bg-success',
        warning: 'bg-warning',
        outline: 'border border-border bg-transparent',
        muted: 'bg-muted',
        priorityLow: 'border border-[#1D572D] bg-[#12261E]',
        priorityMedium: 'border border-[#624711] bg-[#272115]',
        priorityHigh: 'border border-[#792E2E] bg-[#25171C]',
        priorityUrgent: 'border border-[#6C3657] bg-[#221925]',
        taskTodo: 'bg-[#75746D]',
        taskInProgress: 'bg-[#446E99]',
        taskBlocked: 'bg-[#A15851]',
        taskDone: 'bg-[#4B7B5F]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const badgeTextVariants = cva('text-[11px] font-bold uppercase tracking-wide', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      outline: 'text-foreground',
      muted: 'text-muted-foreground',
      priorityLow: 'text-[#3FB950]',
      priorityMedium: 'text-[#D29922]',
      priorityHigh: 'text-[#F85149]',
      priorityUrgent: 'text-[#DB61A2]',
      taskTodo: 'text-white',
      taskInProgress: 'text-white',
      taskBlocked: 'text-white',
      taskDone: 'text-white',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type BadgeProps = React.ComponentProps<typeof View> &
  VariantProps<typeof badgeVariants> & { label?: string };

export function Badge({ className, variant, label, children, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props}>
        {label ? <Text className={badgeTextVariants({ variant })}>{label}</Text> : children}
      </View>
    </TextClassContext.Provider>
  );
}

export { badgeVariants, badgeTextVariants };
