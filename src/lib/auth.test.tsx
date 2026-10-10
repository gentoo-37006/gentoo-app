import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthRetryableFetchError, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './auth';
import { supabase } from './supabase';
import { readCachedProfile } from './auth-profile-cache';
import type { Profile } from './types';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('@/lib/env', () => ({ isSupabaseConfigured: true }));
jest.mock('@/lib/auth-profile-cache', () => ({ readCachedProfile: jest.fn(), writeCachedProfile: jest.fn(), removeCachedProfile: jest.fn() }));
jest.mock('@/lib/demo', () => ({ initDemoAuth: jest.fn(async () => false), isDemoMode: () => false }));
jest.mock('@tanstack/react-query', () => {
  const queryClient = { resetQueries: jest.fn(), clear: jest.fn() };
  return { useQueryClient: () => queryClient };
});
jest.mock('@/lib/supabase', () => {
  const query = { select: () => query, eq: () => query, maybeSingle: () => new Promise(() => {}) };
  return { authStorageKey: 'session', supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() }, from: () => query } };
});

const session = { access_token: 'access', refresh_token: 'refresh', expires_at: 1, user: { id: 'max' } } as Session;
let resolveSession: (result: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void;
let authEvent: (event: AuthChangeEvent, next: Session | null) => void;

function Probe() {
  const auth = useAuth();
  return <Text>{auth.initializing ? 'loading' : !auth.session ? 'signed out' : auth.isApproved ? 'approved' : 'pending'}</Text>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(session));
  jest.mocked(readCachedProfile).mockResolvedValue({ id: 'max', role: 'member', status: 'approved' } as Profile);
  jest.mocked(supabase.auth.getSession).mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
    authEvent = callback;
    return { data: { subscription: { id: 'test', callback, unsubscribe: jest.fn() } } };
  });
});
afterEach(() => { jest.useRealTimers(); });

describe('offline auth startup', () => {
  it('leaves the splash using the saved session and verified profile when refresh stalls', async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading')).toBeTruthy();
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByText('approved')).toBeTruthy();
    await act(async () => { resolveSession({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) }); });
    expect(screen.getByText('approved')).toBeTruthy();
    await screen.unmount();
  });
  it('honors a later rejected session instead of retaining the offline session', async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    await act(async () => { resolveSession({ data: { session: null }, error: null }); });
    expect(screen.getByText('signed out')).toBeTruthy();
    await screen.unmount();
  });
  it('does not let late startup results resurrect an explicitly signed-out session', async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    await act(async () => { authEvent('SIGNED_OUT', null); resolveSession({ data: { session }, error: null }); });
    expect(screen.getByText('signed out')).toBeTruthy();
    await screen.unmount();
  });
  it('does not treat a cached pending account as approved', async () => {
    jest.mocked(readCachedProfile).mockResolvedValue({ id: 'max', role: 'member', status: 'pending' } as Profile);
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByText('pending')).toBeTruthy();
    await screen.unmount();
  });
});
