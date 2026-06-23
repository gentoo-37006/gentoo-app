import * as React from 'react';
import { TextInput } from 'react-native';
import { cn } from '@/lib/utils';

export type InputProps = React.ComponentProps<typeof TextInput>;

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? 'hsl(215 16% 47%)'}
        className={cn(
          'h-11 w-full rounded-lg border border-input bg-background px-3.5 text-base text-foreground',
          'focus:border-ring',
          props.editable === false && 'opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
