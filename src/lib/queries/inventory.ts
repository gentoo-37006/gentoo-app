import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoCheckoutPart,
  demoCreatePart,
  demoCurrentUserId,
  demoDeletePart,
  demoMyOpenCheckoutCount,
  demoPart,
  demoParts,
  demoReturnCheckout,
  demoUpdatePart,
  isDemoMode,
} from '@/lib/demo';
import { removeById, updateById } from '@/lib/optimistic-patch';
import { applyOptimistic, rollback, type Snapshot } from '@/lib/queries/optimistic';
import { signedPhotoUrl } from '@/lib/part-photo';
import type { Part, PartCheckout, Profile } from '@/lib/types';

export const inventoryKeys = {
  parts: ['inventory_parts'] as const,
  part: (id: string) => ['inventory_part', id] as const,
  photo: (path: string) => ['inventory_photo', path] as const,
};

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

/** A part plus the sign-outs that haven't come back, for availability math. */
export type PartWithOpen = Part & {
  open: { id: string; quantity: number; user_id: string | null }[];
};

export type CheckoutWithUser = PartCheckout & {
  user: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
};

export function useParts() {
  return useQuery({
    queryKey: inventoryKeys.parts,
    queryFn: async (): Promise<PartWithOpen[]> => {
      if (isDemoMode()) return demoParts();
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*, open:inventory_checkouts(id, quantity, user_id, returned_at, consumed)')
        .is('open.returned_at', null)
        .eq('open.consumed', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PartWithOpen[];
    },
  });
}

export function usePart(partId: string) {
  return useQuery({
    queryKey: inventoryKeys.part(partId),
    enabled: !!partId,
    queryFn: async () => {
      if (isDemoMode()) return demoPart(partId);
      const [{ data: part, error: partError }, { data: checkouts, error: checkoutError }] =
        await Promise.all([
          supabase.from('inventory_parts').select('*').eq('id', partId).maybeSingle(),
          supabase
            .from('inventory_checkouts')
            .select('*, user:profiles!inventory_checkouts_user_id_fkey(id, full_name, avatar_url)')
            .eq('part_id', partId)
            .order('checked_out_at', { ascending: false })
            .limit(50),
        ]);
      if (partError) throw partError;
      if (checkoutError) throw checkoutError;
      return {
        part: (part ?? null) as Part | null,
        checkouts: (checkouts ?? []) as unknown as CheckoutWithUser[],
      };
    },
  });
}

/** How many parts the given user still has signed out (for the dashboard). */
export function useMyOpenCheckoutCount(uid?: string) {
  return useQuery({
    queryKey: ['my_checkouts', uid],
    enabled: !!uid,
    queryFn: async (): Promise<number> => {
      if (isDemoMode()) return demoMyOpenCheckoutCount(uid);
      const { count, error } = await supabase
        .from('inventory_checkouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid!)
        .eq('consumed', false)
        .is('returned_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Optional optimistic patch of the parts LIST. `my_checkouts` is a derived
 * count and is left to refetch; the part detail cache carries checkout history
 * the client cannot predict, so it refetches too.
 */
type InventoryOptimistic<TVars> = {
  parts?: (list: PartWithOpen[], vars: TVars) => PartWithOpen[];
};

function useInventoryMutation<TVars, TData = unknown>(
  fn: (vars: TVars) => Promise<TData>,
  optimistic?: InventoryOptimistic<TVars>
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: optimistic
      ? (vars: TVars) =>
          applyOptimistic(qc, [inventoryKeys.parts], (data) => optimistic.parts!(data, vars))
      : undefined,
    onError: (_error, _vars, context) => rollback(qc, context as Snapshot),
    // onSettled so a failed mutation resyncs after its rollback.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.parts });
      qc.invalidateQueries({ queryKey: ['inventory_part'] });
      qc.invalidateQueries({ queryKey: ['my_checkouts'] });
    },
  });
}

export type PartInput = Pick<
  Part,
  | 'name'
  | 'part_number'
  | 'manufacturer'
  | 'category'
  | 'location'
  | 'notes'
  | 'quantity'
  | 'consumable'
  | 'unit'
  | 'low_stock_at'
  | 'image_path'
> ;

/** Resolves to the new part's id so callers can open its page. */
/**
 * Signed URL for a part photo. Cached under the object path and refreshed well
 * inside the signature's lifetime, so a screen left open does not start showing
 * broken images.
 */
export function usePartPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.photo(path ?? ''),
    enabled: !!path,
    // Signatures last an hour; re-sign at 45 minutes.
    staleTime: 45 * 60 * 1000,
    queryFn: () => signedPhotoUrl(path!),
  });
}

export function useCreatePart() {
  return useInventoryMutation<PartInput, string>(async (vars) => {
    if (isDemoMode()) return demoCreatePart(vars);
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('inventory_parts')
      .insert({ ...vars, created_by: uid })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  });
}

export function useUpdatePart() {
  return useInventoryMutation<{ id: string } & Partial<PartInput>>(async ({ id, ...patch }) => {
    if (isDemoMode()) return demoUpdatePart(id, patch);
    const { error } = await supabase
      .from('inventory_parts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }, { parts: (list, { id, ...patch }) => updateById(list, id, patch) ?? list });
}

export function useDeletePart() {
  return useInventoryMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeletePart(id);
    const { error } = await supabase.from('inventory_parts').delete().eq('id', id);
    if (error) throw error;
  }, { parts: (list, id) => removeById(list, id) ?? list });
}

/** Signs a part out, or logs consumable usage when `consumed` is set. */
export function useCheckoutPart() {
  return useInventoryMutation<{
    part_id: string;
    quantity: number;
    consumed: boolean;
    purpose: string | null;
  }>(async (vars) => {
    if (isDemoMode()) return demoCheckoutPart(vars);
    const uid = await currentUserId();
    const { error } = await supabase.from('inventory_checkouts').insert({ ...vars, user_id: uid });
    if (error) throw error;
  });
}

export function useReturnCheckout() {
  return useInventoryMutation<string>(async (id) => {
    if (isDemoMode()) return demoReturnCheckout(id);
    const uid = await currentUserId();
    const { error } = await supabase
      .from('inventory_checkouts')
      .update({ returned_at: new Date().toISOString(), returned_by: uid })
      .eq('id', id);
    if (error) throw error;
  });
}
