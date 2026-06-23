import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

/**
 * Standard scrollable page container. Caps content width and centers it on wide
 * screens so the desktop/tablet web layout stays readable, while filling phones.
 */
export function Screen({
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-5xl',
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: string;
}) {
  return (
    <ScrollView
      className={cn('flex-1 bg-background', className)}
      contentContainerClassName="items-center"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        className={cn(
          'w-full gap-5 px-4 py-5 md:px-8 md:py-8',
          maxWidth,
          contentClassName
        )}
      >
        {children}
      </View>
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1 gap-1">
        <Text variant="h2">{title}</Text>
        {description ? <Text variant="muted">{description}</Text> : null}
      </View>
      {children ? (
        <View className="flex-row items-center gap-2">{children}</View>
      ) : null}
    </View>
  );
}
