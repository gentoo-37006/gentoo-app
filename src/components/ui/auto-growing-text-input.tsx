import * as React from 'react';
import { Platform, type TextInput } from 'react-native';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AutoGrowingTextInputProps = Omit<
  TextareaProps,
  'multiline' | 'scrollEnabled' | 'style' | 'value'
> & {
  minHeight: number;
  value: string;
};

function withoutLineBreaks(value: string) {
  return value.replace(/\s*[\r\n]+\s*/g, ' ');
}

export function AutoGrowingTextInput({
  minHeight,
  value,
  onChangeText,
  onContentSizeChange,
  onKeyPress,
  className,
  ...props
}: AutoGrowingTextInputProps) {
  const inputRef = React.useRef<TextInput>(null);
  const [height, setHeight] = React.useState(minHeight);

  React.useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!element?.style) return;

    element.style.height = '0px';
    const nextHeight = Math.max(minHeight, element.scrollHeight);
    element.style.height = `${nextHeight}px`;
    setHeight((current) => (current === nextHeight ? current : nextHeight));
  }, [minHeight, value]);

  return (
    <Textarea
      {...props}
      ref={inputRef}
      value={value}
      onChangeText={(nextValue) => onChangeText?.(withoutLineBreaks(nextValue))}
      onKeyPress={(event) => {
        onKeyPress?.(event);
        if (event.nativeEvent.key !== 'Enter') return;
        event.preventDefault();
        inputRef.current?.blur();
      }}
      onContentSizeChange={(event) => {
        onContentSizeChange?.(event);
        if (Platform.OS !== 'web') {
          const nextHeight = Math.max(minHeight, event.nativeEvent.contentSize.height);
          setHeight((current) => (current === nextHeight ? current : nextHeight));
        }
      }}
      scrollEnabled={false}
      submitBehavior="blurAndSubmit"
      className={cn('overflow-hidden resize-none', className)}
      style={{ height }}
    />
  );
}
