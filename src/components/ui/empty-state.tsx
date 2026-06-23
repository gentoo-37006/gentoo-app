import * as React from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="items-center gap-3 px-6 py-12">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Icon as={icon} size={26} className="text-muted-foreground" />
        </View>
        <Text variant="title" className="text-center">
          {title}
        </Text>
        {description ? (
          <Text variant="muted" className="max-w-sm text-center">
            {description}
          </Text>
        ) : null}
        {children ? <View className="mt-2 items-center">{children}</View> : null}
      </CardContent>
    </Card>
  );
}
