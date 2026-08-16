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
          // px-3.5 matches Input: a textarea sitting under a text field in the
          // same form has to start its text on the same vertical line, and p-3
          // left it 2px to the left of every sibling.
          'min-h-[88px] w-full rounded-lg border border-input bg-background px-3.5 py-3 text-base text-foreground',
          'focus:border-ring',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
