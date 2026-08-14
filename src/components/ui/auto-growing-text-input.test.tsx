import * as React from 'react';
import { StyleSheet } from 'react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { AutoGrowingTextInput } from '@/components/ui/auto-growing-text-input';

describe('AutoGrowingTextInput', () => {
  it('normalizes typed and pasted line breaks to spaces', async () => {
    const onChangeText = jest.fn();
    const screen = await render(
      <AutoGrowingTextInput minHeight={32} value="Project" onChangeText={onChangeText} />
    );

    await fireEvent.changeText(screen.getByDisplayValue('Project'), 'One\nTwo\r\nThree');

    expect(onChangeText).toHaveBeenCalledWith('One Two Three');
  });

  it('contracts when native content becomes shorter', async () => {
    const screen = await render(
      <AutoGrowingTextInput minHeight={32} value="Project" onChangeText={() => {}} />
    );
    const input = screen.getByDisplayValue('Project');

    await fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 200, height: 72 } },
    });
    expect(StyleSheet.flatten(screen.getByDisplayValue('Project').props.style).height).toBe(72);

    await fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 200, height: 32 } },
    });
    expect(StyleSheet.flatten(screen.getByDisplayValue('Project').props.style).height).toBe(32);
  });

  it('does not let a late one-line input measurement collapse wrapped native text', async () => {
    const screen = await render(
      <AutoGrowingTextInput minHeight={32} value="A wrapped task title" onChangeText={() => {}} />
    );
    const input = screen.getByDisplayValue('A wrapped task title');
    const hiddenText = screen.getByText('A wrapped task title');

    await fireEvent(hiddenText, 'layout', {
      nativeEvent: { layout: { width: 180, height: 64 } },
    });
    await fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 180, height: 32 } },
    });

    expect(StyleSheet.flatten(screen.getByDisplayValue('A wrapped task title').props.style).height).toBe(64);
  });
});
