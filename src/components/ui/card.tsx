import * as React from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

export function Card({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        'rounded-md border border-border bg-card',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('gap-1.5 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text variant="title" className={cn('text-card-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text variant="muted" className={className} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('flex-row items-center p-5 pt-0', className)}
      {...props}
    />
  );
}
