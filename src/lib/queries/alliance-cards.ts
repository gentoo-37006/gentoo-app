import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoAllianceCard,
  demoAllianceCards,
  demoCardTemplate,
  demoDeleteAllianceCard,
  demoSaveAllianceCard,
  demoSaveCardTemplate,
  isDemoMode,
} from '@/lib/demo';
import {
  CARD_TEMPLATE_KEY,
  sanitizeAutonPlan,
  sanitizeCardFields,
  templateFromSetting,
  type AutonPlan,
  type CardField,
} from '@/lib/alliance-card';
import type { AllianceCard } from '@/lib/types';

export const allianceCardKeys = {
  all: ['alliance_cards'] as const,
  card: (team: number) => ['alliance_cards', team] as const,
  // Under the app_settings root, so a teammate's edit to the form arrives
  // through the same realtime invalidation as every other setting. The third
  // part keeps it apart from useAppSetting(), which caches the raw row.
  template: ['app_settings', CARD_TEMPLATE_KEY, 'fields'] as const,
};

/** jsonb columns arrive as whatever was stored; rebuild them before any screen sees them. */
function toCard(row: Record<string, unknown>): AllianceCard {
  return {
    ...(row as AllianceCard),
    fields: sanitizeCardFields(row.fields),
    auton: sanitizeAutonPlan(row.auton),
  };
}

// ---- Cards ------------------------------------------------------------------

export function useAllianceCards() {
  return useQuery({
    queryKey: allianceCardKeys.all,
    queryFn: async (): Promise<AllianceCard[]> => {
      if (isDemoMode()) return demoAllianceCards();

      // Expired cards are already invisible to this select. Opening the list is
      // also a moment to delete them; a failure here costs nothing.
      await supabase.rpc('purge_expired_alliance_cards');

      const { data, error } = await supabase
        .from('alliance_cards')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toCard);
    },
  });
}

export function useAllianceCard(team: number | null) {
  return useQuery({
    queryKey: allianceCardKeys.card(team ?? 0),
    enabled: team != null,
    queryFn: async (): Promise<AllianceCard | null> => {
      if (team == null) return null;
      if (isDemoMode()) return demoAllianceCard(team);
      const { data, error } = await supabase
        .from('alliance_cards')
        .select('*')
        .eq('partner_team', team)
        .maybeSingle();
      if (error) throw error;
      return data ? toCard(data) : null;
    },
  });
}

export type SaveAllianceCardInput = {
  partnerTeam: number;
  partnerName: string | null;
  fields: CardField[];
  auton: AutonPlan | null;
};

/**
 * Creates the card for a partner, or replaces the one they already have. Either
 * way the database restarts its one-day clock.
 */
export function useSaveAllianceCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAllianceCardInput): Promise<AllianceCard> => {
      const row = {
        partner_team: input.partnerTeam,
        partner_name: input.partnerName,
        fields: sanitizeCardFields(input.fields),
        auton: sanitizeAutonPlan(input.auton),
      };
      if (isDemoMode()) return demoSaveAllianceCard(row);

      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from('alliance_cards')
        .upsert({ ...row, created_by: session.session?.user?.id ?? null }, { onConflict: 'partner_team' })
        .select('*')
        .single();
      if (error) throw error;
      return toCard(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allianceCardKeys.all });
    },
  });
}

export function useDeleteAllianceCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (team: number) => {
      if (isDemoMode()) return demoDeleteAllianceCard(team);
      const { error } = await supabase.from('alliance_cards').delete().eq('partner_team', team);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allianceCardKeys.all });
    },
  });
}

// ---- The form ---------------------------------------------------------------

/** The shared form: which fields a card has, and our usual answer to each. */
export function useCardTemplate() {
  return useQuery({
    queryKey: allianceCardKeys.template,
    queryFn: async (): Promise<CardField[]> => {
      if (isDemoMode()) return demoCardTemplate();
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', CARD_TEMPLATE_KEY)
        .maybeSingle();
      if (error) throw error;
      return templateFromSetting(data?.value);
    },
  });
}

export function useSaveCardTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields: CardField[]) => {
      const clean = sanitizeCardFields(fields);
      if (isDemoMode()) return demoSaveCardTemplate(clean);
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: CARD_TEMPLATE_KEY, value: { fields: clean }, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: allianceCardKeys.template });
    },
  });
}
