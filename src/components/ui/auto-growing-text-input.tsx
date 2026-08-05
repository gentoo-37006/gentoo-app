import * as React from 'react';
import {
  Platform,
  Text as NativeText,
  type TextInput,
  View,
} from 'react-native';
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
  const isWeb = Platform.OS === 'web';

  React.useLayoutEffect(() => {
    if (!isWeb) return;
    const element = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!element?.style) return;

    element.style.height = '0px';
    const nextHeight = Math.max(minHeight, element.scrollHeight);
    element.style.height = `${nextHeight}px`;
    setHeight((current) => (current === nextHeight ? current : nextHeight));
  }, [isWeb, minHeight, value]);

  const input = (
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
        if (!isWeb) {
          const nextHeight = Math.max(
            minHeight,
            Math.ceil(event.nativeEvent.contentSize.height)
          );
          setHeight((current) => (current === nextHeight ? current : nextHeight));
        }
      }}
      scrollEnabled={false}
      submitBehavior="blurAndSubmit"
      className={cn('overflow-hidden resize-none', className)}
      style={{ height }}
    />
  );

  if (isWeb) return input;

  return (
    <View className="relative w-full" style={{ height }}>
      <NativeText
        accessible={false}
        pointerEvents="none"
        className={cn('absolute w-full opacity-0', className)}
        onLayout={(event) => {
          const nextHeight = Math.max(
            minHeight,
            Math.ceil(event.nativeEvent.layout.height)
          );
          setHeight((current) => (current === nextHeight ? current : nextHeight));
        }}
      >
        {value || ' '}
      </NativeText>
      {input}
    </View>
  );
}
