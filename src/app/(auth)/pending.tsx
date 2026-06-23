import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, RefreshCw, LogOut } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PendingScreen() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const rejected = profile?.status === 'rejected';

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <View className="w-full max-w-sm gap-6">
          <Card>
            <CardContent className="items-center gap-4 px-6 py-10">
              <View
                className={`h-16 w-16 items-center justify-center rounded-2xl ${
                  rejected ? 'bg-destructive/15' : 'bg-warning/15'
                }`}
              >
                <Icon
                  as={Clock}
                  size={30}
                  className={rejected ? 'text-destructive' : 'text-warning'}
                />
              </View>
              <View className="items-center gap-1">
                <Text variant="h3" className="text-center">
                  {rejected ? 'Access not granted' : 'Awaiting approval'}
                </Text>
                <Text variant="muted" className="text-center">
                  {rejected
                    ? 'An administrator has declined your request. Reach out to your team lead if this is a mistake.'
                    : `Hi ${profile?.full_name ?? 'there'} — your account is waiting for an admin to approve it. You’ll get in as soon as they do.`}
                </Text>
              </View>

              {!rejected && (
                <Button
                  variant="outline"
                  label="Check again"
                  icon={RefreshCw}
                  loading={refreshing}
                  onPress={onRefresh}
                  className="w-full"
                />
              )}
            </CardContent>
          </Card>

          <Button variant="ghost" label="Sign out" icon={LogOut} onPress={signOut} />
        </View>
      </View>
    </SafeAreaView>
  );
}
