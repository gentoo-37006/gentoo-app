import * as React from 'react';
import { Alert, Platform, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { ConfirmationButton } from '@/components/ui/delete-button';
import { Text } from '@/components/ui/text';
import { deleteOwnAccount } from '@/lib/queries/profiles';

export function AccountDeletionButton({ className }: { className?: string }) {
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const onDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteOwnAccount();
    } catch {
      setDeleteError('Could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  const confirmAccountDeletion = () => {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' &&
        window.confirm('Delete your account permanently? This cannot be undone.');
      if (confirmed) void onDelete();
      return;
    }

    Alert.alert(
      'Delete account?',
      'Your account and sign-in will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => void onDelete(),
        },
      ]
    );
  };

  return (
    <View className="gap-2">
      <ConfirmationButton
        variant="destructive"
        label="Delete my account"
        icon={Trash2}
        confirmationAction="delete your account"
        loading={deleting}
        disabled={deleting}
        onPress={confirmAccountDeletion}
        className={className}
      />
      {deleteError ? <Text className="text-destructive">{deleteError}</Text> : null}
    </View>
  );
}
