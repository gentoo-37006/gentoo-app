import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ShieldCheck, ShieldOff, UserCheck, Check, X, Lock } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { FUNCTIONAL_ROLES, type FunctionalRole, type Profile } from '@/lib/types';
import {
  useProfiles,
  useSetUserStatus,
  useSetUserRole,
  useSetFunctionalRoles,
} from '@/lib/queries/profiles';

function PersonHeader({ profile }: { profile: Profile }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar name={profile.full_name} uri={profile.avatar_url} size={40} />
      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {profile.full_name ?? 'Unnamed member'}
        </Text>
        {profile.email ? (
          <Text variant="small" numberOfLines={1}>
            {profile.email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PendingCard({ profile }: { profile: Profile }) {
  const setStatus = useSetUserStatus();
  const busy = setStatus.isPending && setStatus.variables?.id === profile.id;
  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <PersonHeader profile={profile} />
        <View className="flex-row gap-2">
          <Button
            variant="success"
            size="sm"
            label="Approve"
            icon={Check}
            loading={busy && setStatus.variables?.status === 'approved'}
            disabled={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: profile.id, status: 'approved' })}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            label="Reject"
            icon={X}
            loading={busy && setStatus.variables?.status === 'rejected'}
            disabled={setStatus.isPending}
            onPress={() => setStatus.mutate({ id: profile.id, status: 'rejected' })}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

function RoleChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'rounded-sm border px-3 py-1.5',
        active ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent',
        disabled && 'opacity-50'
      )}
    >
      <Text
        className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MemberCard({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const setRole = useSetUserRole();
  const setStatus = useSetUserStatus();
  const setFns = useSetFunctionalRoles();
  const busy = setRole.isPending || setStatus.isPending || setFns.isPending;

  const toggleFn = (role: FunctionalRole) => {
    const has = profile.functional_roles.includes(role);
    const next = has
      ? profile.functional_roles.filter((r) => r !== role)
      : [...profile.functional_roles, role];
    setFns.mutate({ id: profile.id, functional_roles: next });
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={profile.full_name} uri={profile.avatar_url} size={40} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-semibold" numberOfLines={1}>
                {profile.full_name ?? 'Unnamed member'}
              </Text>
              {profile.role === 'admin' ? <Badge variant="default" label="Admin" /> : null}
              {isSelf ? <Badge variant="muted" label="You" /> : null}
            </View>
            {profile.email ? (
              <Text variant="small" numberOfLines={1}>
                {profile.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="gap-1.5">
          <Text variant="small">Functional roles</Text>
          <View className="flex-row flex-wrap gap-2">
            {FUNCTIONAL_ROLES.map((r) => (
              <RoleChip
                key={r.value}
                label={r.label}
                active={profile.functional_roles.includes(r.value)}
                disabled={busy}
                onPress={() => toggleFn(r.value)}
              />
            ))}
          </View>
        </View>

        {!isSelf ? (
          <View className="flex-row gap-2">
            {profile.role === 'admin' ? (
              <Button
                variant="outline"
                size="sm"
                label="Remove admin"
                icon={ShieldOff}
                disabled={busy}
                onPress={() => setRole.mutate({ id: profile.id, role: 'member' })}
                className="flex-1"
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                label="Make admin"
                icon={ShieldCheck}
                disabled={busy}
                onPress={() => setRole.mutate({ id: profile.id, role: 'admin' })}
                className="flex-1"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              label="Revoke"
              icon={X}
              disabled={busy}
              onPress={() => setStatus.mutate({ id: profile.id, status: 'rejected' })}
              className="flex-1"
            />
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminScreen() {
  const { isAdmin, profile: me } = useAuth();
  const { data: profiles, isLoading, isError } = useProfiles();

  if (!isAdmin) {
    return (
      <Screen maxWidth="max-w-2xl">
        <ScreenHeader title="Admin" description="Approve members and manage roles." />
        <EmptyState
          icon={Lock}
          title="Admins only"
          description="You don’t have administrator access. Ask a team admin if you need it."
        />
      </Screen>
    );
  }

  const pending = (profiles ?? []).filter((p) => p.status === 'pending');
  const members = (profiles ?? []).filter((p) => p.status === 'approved');

  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader title="Admin" description="Approve members and manage roles." />

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : isError ? (
        <EmptyState
          icon={ShieldOff}
          title="Couldn’t load members"
          description="Check your connection and Supabase configuration, then try again."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
              <CardDescription>
                {pending.length === 0
                  ? 'No one is waiting for access right now.'
                  : `${pending.length} ${pending.length === 1 ? 'person is' : 'people are'} waiting for access.`}
              </CardDescription>
            </CardHeader>
            {pending.length > 0 ? (
              <CardContent className="gap-3">
                {pending.map((p) => (
                  <PendingCard key={p.id} profile={p} />
                ))}
              </CardContent>
            ) : null}
          </Card>

          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon as={UserCheck} size={18} className="text-muted-foreground" />
              <Text variant="title">Team members ({members.length})</Text>
            </View>
            {members.map((p) => (
              <MemberCard key={p.id} profile={p} isSelf={p.id === me?.id} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
