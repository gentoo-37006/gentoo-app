import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Radio, Plus, Hand, Check, X, MessageSquare } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import {
  useTalkieRequests,
  useTalkieRealtime,
  useCreateTalkie,
  useClaimTalkie,
  useResolveTalkie,
  useDeleteTalkie,
  type TalkieWithPeople,
} from '@/lib/queries/talkie';

function CreateForm({ onClose }: { onClose: () => void }) {
  const create = useCreateTalkie();
  const [teamNumber, setTeamNumber] = React.useState('');
  const [reason, setReason] = React.useState('');
  const parsed = parseInt(teamNumber.trim(), 10);
  const canSubmit = Number.isFinite(parsed) && parsed > 0 && reason.trim().length > 0 && !create.isPending;

  const onSubmit = async () => {
    await create.mutateAsync({ teamNumber: parsed, reason: reason.trim() });
    onClose();
  };

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        <Text variant="title">New request</Text>
        <View className="gap-1.5">
          <Text variant="label">Team number</Text>
          <Input value={teamNumber} onChangeText={setTeamNumber} keyboardType="number-pad" placeholder="e.g. 14584" />
        </View>
        <View className="gap-1.5">
          <Text variant="label">What do you need to know?</Text>
          <Textarea value={reason} onChangeText={setReason} placeholder="e.g. Did their intake break in Q12?" />
        </View>
        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={onClose} className="flex-1" />
          <Button
            label="Send ping"
            icon={Radio}
            loading={create.isPending}
            disabled={!canSubmit}
            onPress={onSubmit}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

function TalkieCard({ request }: { request: TalkieWithPeople }) {
  const { session, isAdmin } = useAuth();
  const uid = session?.user?.id;
  const claim = useClaimTalkie();
  const resolve = useResolveTalkie();
  const del = useDeleteTalkie();
  const [response, setResponse] = React.useState('');

  const canDelete = isAdmin || request.requester_id === uid;
  const statusBadge =
    request.status === 'open' ? (
      <Badge variant="warning" label="Open" />
    ) : request.status === 'claimed' ? (
      <Badge variant="default" label="On it" />
    ) : (
      <Badge variant="success" label="Resolved" />
    );

  return (
    <Card className={request.status === 'open' ? 'border-warning/40' : ''}>
      <CardContent className="gap-3 p-4">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-semibold">Team {request.team_number}</Text>
              {statusBadge}
              {canDelete ? (
                <Pressable
                  onPress={() => del.mutate(request.id)}
                  className="h-7 w-7 items-center justify-center rounded-full active:bg-accent"
                >
                  <Icon as={X} size={16} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
            <Text variant="muted">{request.reason}</Text>
            <Text variant="small">
              {request.requester?.full_name ?? 'Someone'} · {timeAgo(request.created_at)}
            </Text>
          </View>
        </View>

        {request.status === 'open' ? (
          <Button
            label="I’ll go ask"
            icon={Hand}
            size="sm"
            loading={claim.isPending}
            onPress={() =>
              claim.mutate({
                id: request.id,
                requesterId: request.requester_id,
                teamNumber: request.team_number,
              })
            }
          />
        ) : null}

        {request.status === 'claimed' ? (
          <View className="gap-2 border-t border-border pt-3">
            <View className="flex-row items-center gap-2">
              <Avatar name={request.claimer?.full_name} uri={request.claimer?.avatar_url} size={22} />
              <Text variant="small">{request.claimer?.full_name ?? 'A teammate'} is on it</Text>
            </View>
            <Textarea
              value={response}
              onChangeText={setResponse}
              placeholder="What did you find out?"
              className="min-h-[64px]"
            />
            <Button
              label="Resolve"
              icon={Check}
              size="sm"
              loading={resolve.isPending}
              disabled={response.trim().length === 0 || resolve.isPending}
              onPress={() =>
                resolve.mutate({
                  id: request.id,
                  response: response.trim(),
                  requesterId: request.requester_id,
                  teamNumber: request.team_number,
                })
              }
            />
          </View>
        ) : null}

        {request.status === 'resolved' && request.response ? (
          <View className="flex-row items-start gap-2 rounded-lg bg-muted p-3">
            <Icon as={MessageSquare} size={16} className="mt-0.5 text-muted-foreground" />
            <Text className="flex-1 text-sm">{request.response}</Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TalkieScreen() {
  useTalkieRealtime();
  const { data, isLoading } = useTalkieRequests();
  const [creating, setCreating] = React.useState(false);
  const requests = data ?? [];
  const active = requests.filter((r) => r.status !== 'resolved');
  const resolved = requests.filter((r) => r.status === 'resolved');

  return (
    <Screen>
      <ScreenHeader title="Talkie" description="Ping the pit crew to go find something out.">
        {!creating ? <Button label="New" icon={Plus} onPress={() => setCreating(true)} /> : null}
      </ScreenHeader>

      {creating ? <CreateForm onClose={() => setCreating(false)} /> : null}

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No active talkies"
          description="When something happens in a match, raise a talkie and an available pit member will be pinged to go investigate."
        />
      ) : (
        <>
          {active.length > 0 ? (
            <View className="gap-3">
              {active.map((r) => (
                <TalkieCard key={r.id} request={r} />
              ))}
            </View>
          ) : null}
          {resolved.length > 0 ? (
            <View className="gap-3">
              <Text variant="title">Resolved</Text>
              {resolved.map((r) => (
                <TalkieCard key={r.id} request={r} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
