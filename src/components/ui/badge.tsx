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
        priorityLow:
          'border border-[#8BC49A] bg-[#E0F1E4] dark:border-[#1D572D] dark:bg-[#12261E]',
        priorityMedium:
          'border border-[#D8B150] bg-[#F7E9BC] dark:border-[#624711] dark:bg-[#272115]',
        priorityHigh:
          'border border-[#D98984] bg-[#F4D9D7] dark:border-[#792E2E] dark:bg-[#25171C]',
        priorityUrgent:
          'border border-[#C984AA] bg-[#EFD9E6] dark:border-[#6C3657] dark:bg-[#221925]',
        taskTodo: 'bg-[#75746D]',
        taskInProgress: 'bg-[#446E99]',
        taskBlocked: 'bg-[#A15851]',
        taskDone: 'bg-[#4B7B5F]',
        allianceBlue: 'bg-alliance-blue',
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
      priorityLow: 'text-[#12692B] dark:text-[#3FB950]',
      priorityMedium: 'text-[#755300] dark:text-[#D29922]',
      priorityHigh: 'text-[#A72721] dark:text-[#F85149]',
      priorityUrgent: 'text-[#86275E] dark:text-[#DB61A2]',
      taskTodo: 'text-white',
      taskInProgress: 'text-white',
      taskBlocked: 'text-white',
      taskDone: 'text-white',
      allianceBlue: 'text-white',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type BadgeProps = React.ComponentProps<typeof View> &
  VariantProps<typeof badgeVariants> & { label?: string; singleLine?: boolean };

export function Badge({ className, variant, label, singleLine, children, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View
        className={cn(badgeVariants({ variant }), singleLine && 'shrink-0', className)}
        {...props}
      >
        {label ? (
          <Text
            numberOfLines={singleLine ? 1 : undefined}
            className={badgeTextVariants({ variant })}
          >
            {label}
          </Text>
        ) : children}
      </View>
    </TextClassContext.Provider>
  );
}

export { badgeVariants, badgeTextVariants };
