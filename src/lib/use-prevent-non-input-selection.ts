import * as React from 'react';
import { Platform } from 'react-native';

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

/** Prevents browser selection and dragging while preserving normal text-field behavior. */
export function usePreventNonInputSelection() {
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const preventOutsideInputs = (event: Event) => {
      if (!isEditableTarget(event.target)) event.preventDefault();
    };
    const preventSelectAllOutsideInputs = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'a' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('selectstart', preventOutsideInputs, true);
    document.addEventListener('dragstart', preventOutsideInputs, true);
    document.addEventListener('keydown', preventSelectAllOutsideInputs, true);
    return () => {
      document.removeEventListener('selectstart', preventOutsideInputs, true);
      document.removeEventListener('dragstart', preventOutsideInputs, true);
      document.removeEventListener('keydown', preventSelectAllOutsideInputs, true);
    };
  }, []);
}
