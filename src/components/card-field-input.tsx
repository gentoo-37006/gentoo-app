import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_VALUE_LENGTH, type CardField } from '@/lib/alliance-card';

/**
 * The answer box for one scouting-card field. The form editor and the card
 * editor both use it, so an answer is typed the same way in both places.
 */
export function CardFieldInput({
  field,
  onChangeText,
  placeholder,
}: {
  field: CardField;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  if (field.kind === 'paragraph') {
    return (
      <Textarea
        value={field.value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={MAX_VALUE_LENGTH}
      />
    );
  }
  return (
    <Input
      value={field.value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
      maxLength={field.kind === 'number' ? 12 : MAX_VALUE_LENGTH}
    />
  );
}
