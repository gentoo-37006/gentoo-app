import * as React from 'react';
import { type TextInput } from 'react-native';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const InventoryInput = React.forwardRef<TextInput, InputProps>(
  ({ className, placeholderTextColor = 'hsl(0 0% 47%)', ...props }, ref) => (
    <Input
      ref={ref}
      placeholderTextColor={placeholderTextColor}
      className={cn('select-text outline-none focus:border-input', className)}
      {...props}
    />
  )
);

InventoryInput.displayName = 'InventoryInput';
