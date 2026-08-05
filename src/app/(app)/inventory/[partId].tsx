import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Boxes,
  PackageMinus,
  PackagePlus,
  Pencil,
  Printer,
  Undo2,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { QrCode } from '@/components/ui/qr-code';
import { ModalSheet } from '@/components/ui/modal-sheet';
import { PartEditor } from '@/components/part-editor';
import {
  usePart,
  useCheckoutPart,
  useDeletePart,
  useReturnCheckout,
  useUpdatePart,
  type CheckoutWithUser,
} from '@/lib/queries/inventory';
import { partUrl, printLabels } from '@/lib/inventory-label';
import { labelOf } from '@/lib/task-style';
import { timeAgo } from '@/lib/format';
import { PART_CATEGORIES, checkedOutQuantity, isLowStock, type Part } from '@/lib/types';

type Dialog = 'take' | 'stock' | 'edit' | null;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[100px] flex-1 rounded-md border border-border bg-card p-4">
      <Text className="text-2xl font-extrabold">{value}</Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text variant="label" className="text-muted-foreground">
        {label}
      </Text>
      <Text className="flex-1 text-right text-sm">{value}</Text>
    </View>
  );
}

/** Shared body for "check out", "log usage" and "add stock". */
function QuantityDialog({
  title,
  description,
  confirmLabel,
  max,
  withPurpose,
  busy,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  max?: number;
  withPurpose?: boolean;
  busy: boolean;
  onSubmit: (quantity: number, purpose: string | null) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = React.useState('1');
  const [purpose, setPurpose] = React.useState('');
  const amount = Math.max(0, Math.round(Number(quantity) || 0));
  const invalid = amount < 1 || (max !== undefined && amount > max);

  return (
    <Card className="border-primary/40">
      <CardContent className="gap-3 p-4">
        <Text variant="title">{title}</Text>
        <Text variant="muted">{description}</Text>
        <View className="gap-1.5">
          <Text variant="label">Quantity</Text>
          <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" autoFocus />
        </View>
        {withPurpose ? (
          <View className="gap-1.5">
            <Text variant="label">What for</Text>
            <Input value={purpose} onChangeText={setPurpose} placeholder="Competition robot, prototype…" />
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <Button variant="ghost" label="Cancel" onPress={onCancel} className="flex-1" />
          <Button
            label={confirmLabel}
            loading={busy}
            disabled={busy || invalid}
            onPress={() => onSubmit(amount, purpose.trim() || null)}
            className="flex-1"
          />
        </View>
      </CardContent>
    </Card>
  );
}

function CheckoutRow({
  checkout,
  unit,
  onReturn,
  returning,
}: {
  checkout: CheckoutWithUser;
  unit: string | null;
  onReturn?: () => void;
  returning?: boolean;
}) {
  const suffix = unit ? ` ${unit}` : '';
  return (
    <View className="flex-row items-center gap-3 rounded-md border border-border bg-card p-4">
      <Avatar name={checkout.user?.full_name} uri={checkout.user?.avatar_url} size={32} />
      <View className="flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {checkout.user?.full_name ?? 'Unknown member'} · {checkout.quantity}
          {suffix}
        </Text>
        <Text variant="small" numberOfLines={1}>
          {checkout.purpose ? `${checkout.purpose} · ` : ''}
          {timeAgo(checkout.checked_out_at)}
        </Text>
      </View>
      {onReturn ? (
        <Button
          variant="outline"
          size="sm"
          label="Return"
          icon={Undo2}
          loading={returning}
          disabled={returning}
          onPress={onReturn}
        />
      ) : (
        <Badge
          variant={checkout.consumed ? 'secondary' : 'muted'}
          label={checkout.consumed ? 'Used' : 'Returned'}
        />
      )}
    </View>
  );
}

function PartDetail({ part, checkouts }: { part: Part; checkouts: CheckoutWithUser[] }) {
  const router = useRouter();
  const checkout = useCheckoutPart();
  const returnCheckout = useReturnCheckout();
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();
  const [dialog, setDialog] = React.useState<Dialog>(null);

  const open = checkouts.filter((row) => !row.consumed && !row.returned_at);
  const history = checkouts.filter((row) => row.consumed || row.returned_at).slice(0, 10);
  const out = checkedOutQuantity(open);
  const available = Math.max(0, part.quantity - out);
  const used = checkouts.filter((row) => row.consumed).reduce((total, row) => total + row.quantity, 0);
  const low = isLowStock(part, available);
  const url = partUrl(part.id);

  const details = [
    { label: 'Category', value: labelOf(PART_CATEGORIES, part.category) },
    ...(part.part_number ? [{ label: 'Part number', value: part.part_number }] : []),
    ...(part.location ? [{ label: 'Location', value: part.location }] : []),
    ...(part.low_stock_at != null
      ? [{ label: 'Low stock at', value: `${part.low_stock_at}${part.unit ? ` ${part.unit}` : ''}` }]
      : []),
    ...(part.notes ? [{ label: 'Notes', value: part.notes }] : []),
  ];

  return (
    <Screen maxWidth="max-w-3xl">
      <ScreenHeader
        title={part.name}
        description={part.consumable ? 'Consumable — logged usage lowers stock.' : 'Signed out and returned by the team.'}
        backHref="/inventory"
      >
        <Button
          variant="outline"
          size="sm"
          label="Edit"
          icon={Pencil}
          onPress={() => setDialog('edit')}
        />
        <DeleteButton
          variant="outline"
          size="sm"
          label="Delete"
          loading={deletePart.isPending}
          onPress={async () => {
            await deletePart.mutateAsync(part.id);
            router.replace('/inventory' as any);
          }}
        />
      </ScreenHeader>

      <View className="flex-row flex-wrap gap-3">
        <Stat label={part.consumable ? 'In stock' : 'Available'} value={available} />
        {part.consumable ? (
          <Stat label="Used to date" value={used} />
        ) : (
          <>
            <Stat label="Checked out" value={out} />
            <Stat label="Owned" value={part.quantity} />
          </>
        )}
      </View>

      {low ? (
        <Card className="border-warning">
          <CardContent className="p-4">
            <Text className="text-sm font-semibold">
              Low stock — {available}
              {part.unit ? ` ${part.unit}` : ''} left, at or below the {part.low_stock_at} warning level.
            </Text>
          </CardContent>
        </Card>
      ) : null}

      <View className="flex-row gap-3">
        <Button
          className="flex-1"
          label={part.consumable ? 'Log usage' : 'Check out'}
          icon={PackageMinus}
          disabled={available === 0}
          onPress={() => setDialog('take')}
        />
        <Button
          className="flex-1"
          variant="outline"
          label="Add stock"
          icon={PackagePlus}
          onPress={() => setDialog('stock')}
        />
      </View>

      <Card>
        <CardContent className="gap-2.5 p-4">
          {details.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </CardContent>
      </Card>

      {open.length > 0 ? (
        <View className="gap-3">
          <Text variant="title">Out now</Text>
          {open.map((row) => (
            <CheckoutRow
              key={row.id}
              checkout={row}
              unit={part.unit}
              returning={returnCheckout.isPending}
              onReturn={() => returnCheckout.mutate(row.id)}
            />
          ))}
        </View>
      ) : null}

      {history.length > 0 ? (
        <View className="gap-3">
          <Text variant="title">Recent activity</Text>
          {history.map((row) => (
            <CheckoutRow key={row.id} checkout={row} unit={part.unit} />
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <Text variant="title">QR label</Text>
        <Card>
          <CardContent className="flex-row flex-wrap items-center gap-4 p-4">
            <QrCode value={url} size={140} />
            <View className="min-w-[180px] flex-1 gap-2">
              <Text variant="muted">
                Print this and stick it on the bin. Scanning it opens this page, so anyone can sign the
                part in or out from their phone.
              </Text>
              <Text variant="small" selectable>
                {url}
              </Text>
              {Platform.OS === 'web' ? (
                <Button
                  variant="outline"
                  size="sm"
                  label="Print label"
                  icon={Printer}
                  className="self-start"
                  onPress={() => printLabels([part])}
                />
              ) : null}
            </View>
          </CardContent>
        </Card>
      </View>

      <ModalSheet visible={dialog !== null} onClose={() => setDialog(null)}>
        {dialog === 'edit' ? (
          <PartEditor initial={part} onDone={() => setDialog(null)} />
        ) : dialog === 'take' ? (
          <QuantityDialog
            title={part.consumable ? 'Log usage' : 'Check out'}
            description={
              part.consumable
                ? `${available}${part.unit ? ` ${part.unit}` : ''} in stock.`
                : `${available} of ${part.quantity} available.`
            }
            confirmLabel={part.consumable ? 'Log usage' : 'Check out'}
            max={available}
            withPurpose
            busy={checkout.isPending}
            onSubmit={async (quantity, purpose) => {
              await checkout.mutateAsync({
                part_id: part.id,
                quantity,
                consumed: part.consumable,
                purpose,
              });
              setDialog(null);
            }}
            onCancel={() => setDialog(null)}
          />
        ) : dialog === 'stock' ? (
          <QuantityDialog
            title="Add stock"
            description="Restocking after a delivery? Add the new units to the count."
            confirmLabel="Add"
            busy={updatePart.isPending}
            onSubmit={async (quantity) => {
              await updatePart.mutateAsync({ id: part.id, quantity: part.quantity + quantity });
              setDialog(null);
            }}
            onCancel={() => setDialog(null)}
          />
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

export default function PartScreen() {
  const { partId } = useLocalSearchParams<{ partId: string }>();
  const { data, isLoading } = usePart(partId);

  if (isLoading) {
    return (
      <Screen maxWidth="max-w-3xl">
        <View className="py-12">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (!data?.part) {
    return (
      <Screen maxWidth="max-w-3xl">
        <ScreenHeader title="Part" backHref="/inventory" />
        <EmptyState
          icon={Boxes}
          title="Part not found"
          description="It may have been deleted from the inventory."
        />
      </Screen>
    );
  }

  return <PartDetail part={data.part} checkouts={data.checkouts} />;
}
