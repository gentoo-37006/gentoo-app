import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ActiveEventCard } from './active-event-card';
import { useAuth } from '@/lib/auth';
import { useAppSetting } from '@/lib/queries/settings';
import { useFTCScoutEvent } from '@/lib/queries/ftcscout';

jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/queries/settings', () => ({ ACTIVE_EVENT_KEY: 'active_event', useAppSetting: jest.fn() }));
jest.mock('@/lib/queries/ftcscout', () => ({ useFTCScoutEvent: jest.fn() }));
jest.mock('@/lib/use-now', () => ({ useNow: () => new Date(2026, 10, 5).getTime() }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

const settingResult = {
  data: { value: { eventCode: 'CAONCMP', last_synced: '2026-02-22T12:00:00Z' } },
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
const eventResult = {
  data: {
    name: 'FIRST Tech Challenge Ontario Provincial Championship',
    start: '2026-02-21', end: '2026-02-22',
    venue: 'Brock University, Ian Beddis Gymnasium', city: 'St. Catharines', state: 'ON', country: 'Canada',
  },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: jest.fn(),
};

// The query hooks are boundaries here; these cases exercise the visible states
// and actions without requiring auth, Supabase, or live FTCScout access.
function mockSetting(result: unknown) {
  jest.mocked(useAppSetting).mockReturnValue(result as ReturnType<typeof useAppSetting>);
}
function mockEvent(result: unknown) {
  jest.mocked(useFTCScoutEvent).mockReturnValue(result as ReturnType<typeof useFTCScoutEvent>);
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({ isDemo: false } as ReturnType<typeof useAuth>);
  mockSetting(settingResult);
  mockEvent(eventResult);
});

describe('active event overview', () => {
  it('shows the event details and opens the saved event season', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = await render(<ActiveEventCard />);
    expect(screen.getByText(eventResult.data.name)).toBeTruthy();
    expect(screen.getByText(eventResult.data.venue)).toBeTruthy();
    expect(screen.getByText('St. Catharines, ON, Canada')).toBeTruthy();
    expect(screen.getByText('CAONCMP · 2025 season')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('View event on FTCScout'));
    expect(openURL).toHaveBeenCalledWith('https://ftcscout.org/events/2025/CAONCMP');
    openURL.mockRestore();
    await screen.unmount();
  });

  it('retains the code and link during loading and offers retry after failure', async () => {
    mockEvent({ ...eventResult, data: undefined, isLoading: true });
    const screen = await render(<ActiveEventCard />);
    expect(screen.getByLabelText('Loading event details')).toBeTruthy();
    expect(screen.getByLabelText('View event on FTCScout')).toBeTruthy();
    mockEvent({ ...eventResult, data: undefined, isError: true });
    await screen.rerender(<ActiveEventCard />);
    expect(screen.getByText('Event details unavailable.')).toBeTruthy();
    expect(screen.getByText('CAONCMP · 2025 season')).toBeTruthy();
    expect(screen.getByLabelText('View event on FTCScout')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(eventResult.refetch).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('does not mistake a loading or failed setting for an unconfigured event', async () => {
    mockSetting({ ...settingResult, data: null, isPending: true });
    const screen = await render(<ActiveEventCard />);
    expect(screen.getByLabelText('Loading active event')).toBeTruthy();
    expect(screen.queryByText('No active event')).toBeNull();
    mockSetting({ ...settingResult, data: null, isError: true });
    await screen.rerender(<ActiveEventCard />);
    expect(screen.getByText('Active event unavailable.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(settingResult.refetch).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('shows an empty state for an unconfigured workspace and for demo mode', async () => {
    mockSetting({ ...settingResult, data: null });
    const screen = await render(<ActiveEventCard />);
    expect(screen.getByText('No active event')).toBeTruthy();
    expect(screen.getByText('Go to Settings')).toBeTruthy();
    mockSetting(settingResult);
    jest.mocked(useAuth).mockReturnValue({ isDemo: true } as ReturnType<typeof useAuth>);
    await screen.rerender(<ActiveEventCard />);
    expect(screen.getByText('No active event')).toBeTruthy();
    expect(screen.queryByLabelText('View event on FTCScout')).toBeNull();
    expect(useFTCScoutEvent).toHaveBeenLastCalledWith('', 2026);
    await screen.unmount();
  });

  it('updates the lookup identity and clears the old event when the setting changes', async () => {
    const screen = await render(<ActiveEventCard />);
    mockSetting({ ...settingResult, data: { value: { eventCode: 'NEWCODE', season: 2026 } } });
    mockEvent({ ...eventResult, data: undefined, isLoading: true });
    await screen.rerender(<ActiveEventCard />);
    expect(useFTCScoutEvent).toHaveBeenLastCalledWith('NEWCODE', 2026);
    expect(screen.queryByText(eventResult.data.name)).toBeNull();
    expect(screen.getByText('NEWCODE · 2026 season')).toBeTruthy();
    await screen.unmount();
  });

  it('renders partial metadata without empty date and location rows', async () => {
    mockEvent({ ...eventResult, data: { ...eventResult.data, start: null, end: null, venue: null, city: null, state: null, country: null } });
    const screen = await render(<ActiveEventCard />);
    expect(screen.getByText(eventResult.data.name)).toBeTruthy();
    expect(screen.queryByText(eventResult.data.venue)).toBeNull();
    expect(screen.getByLabelText('View event on FTCScout')).toBeTruthy();
    await screen.unmount();
  });
});
