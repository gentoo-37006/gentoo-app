import * as React from 'react';
import { TextInput } from 'react-native';
import { cn } from '@/lib/utils';

export type TextareaProps = React.ComponentProps<typeof TextInput>;

export const Textarea = React.forwardRef<TextInput, TextareaProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        multiline
        textAlignVertical="top"
        placeholderTextColor={placeholderTextColor ?? 'hsl(215 16% 47%)'}
        className={cn(
          'min-h-[88px] w-full rounded-lg border border-input bg-background p-3 text-base text-foreground',
          'focus:border-ring',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
