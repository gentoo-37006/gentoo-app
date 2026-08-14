import * as React from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { MultiSelect } from '@/components/ui/select';
import { Text } from '@/components/ui/text';

const ADD_TAG = '__add_task_tag__';

function distinctTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function TaskTagsSelect({
  values,
  availableTags,
  onChange,
  onOpenChange,
  className,
}: {
  values: string[];
  availableTags: string[];
  onChange: (tags: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const tags = distinctTags([...values, ...availableTags]);
  const options = [
    { value: ADD_TAG, label: 'Add new tag' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ];

  return (
    <MultiSelect
      options={options}
      values={values}
      onChange={(nextValues, query) => {
        if (nextValues.includes(ADD_TAG)) {
          const searchedTag = query?.trim().toLowerCase();
          if (!searchedTag) return false;
          const existingTag = tags.find((tag) => tag.toLowerCase() === searchedTag);
          onChange(distinctTags([...values, existingTag ?? searchedTag]));
          return;
        }
        onChange(nextValues);
      }}
      placeholder="No tags"
      className={className}
      pinnedValues={[ADD_TAG]}
      onOpenChange={onOpenChange}
      renderValue={(selectedOptions) => (
        <View className="flex-row flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge
              key={option.value}
              variant="muted"
              label={option.label}
              singleLine
            />
          ))}
        </View>
      )}
      renderOption={(option) =>
        option.value === ADD_TAG ? (
          <View className="flex-row items-center gap-2">
            <Icon as={Plus} size={16} className="text-primary" />
            <Text className="text-sm font-medium text-primary">{option.label}</Text>
          </View>
        ) : (
          <Badge variant="muted" label={option.label} singleLine />
        )
      }
      renderSelectedOption={(option) => (
        <Text className="text-sm font-medium">{option.label}</Text>
      )}
    />
  );
}
