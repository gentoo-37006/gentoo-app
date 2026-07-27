import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

/**
 * Standard scrollable page container. Fills the viewport width under the top
 * navbar; pass maxWidth (e.g. 'max-w-2xl') for pages that read better narrow.
 */
export function Screen({
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-6xl',
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
  backHref,
  children,
}: {
  title: string;
  description?: string;
  /** When set, shows a back chevron and provides a fallback for direct visits. */
  backHref?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View className="gap-2">
      {backHref ? (
        <Pressable
          className="-ml-1 flex-row items-center gap-1 self-start py-1 active:opacity-70"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(backHref as any);
            }
          }}
        >
          <Icon as={ChevronLeft} size={18} className="text-muted-foreground" />
          <Text variant="muted">Back</Text>
        </Pressable>
      ) : null}
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text variant="h2">{title}</Text>
          {description ? <Text variant="muted">{description}</Text> : null}
        </View>
        {children ? <View className="flex-row items-center gap-2">{children}</View> : null}
      </View>
    </View>
  );
}
