import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useAppSetting } from '@/lib/queries/settings';
import { useFTCScoutEvent } from '@/lib/queries/ftcscout';
import { useHomeRoute } from '@/lib/use-home-route';

jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/queries/settings', () => ({ ACTIVE_EVENT_KEY: 'active_event', useAppSetting: jest.fn() }));
jest.mock('@/lib/queries/ftcscout', () => ({ useFTCScoutEvent: jest.fn() }));
jest.mock('@/lib/use-now', () => ({ useNow: () => new Date(2026, 10, 10, 12).getTime() }));

function Probe({ enabled = true }: { enabled?: boolean }) {
  const home = useHomeRoute(enabled);
  return <Text>{home.ready ? home.href : 'waiting'}</Text>;
}

function mockSetting(data: unknown, isPending = false) {
  jest.mocked(useAppSetting).mockReturnValue({ data, isPending } as ReturnType<typeof useAppSetting>);
}
function mockEvent(data: unknown, isPending = false) {
  jest.mocked(useFTCScoutEvent).mockReturnValue({ data, isPending } as ReturnType<typeof useFTCScoutEvent>);
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({ isDemo: false } as ReturnType<typeof useAuth>);
  mockSetting({ value: { eventCode: 'CAONTEST', season: 2026 } });
  mockEvent({ start: '2026-11-10', end: '2026-11-11' });
});

describe('home route startup (shared by web, iOS, and Android)', () => {
  it('waits for settings and event details before selecting the event-day home', async () => {
    mockSetting(undefined, true);
    mockEvent(undefined, true);
    const screen = await render(<Probe />);
    expect(screen.getByText('waiting')).toBeTruthy();
    mockSetting({ value: { eventCode: 'CAONTEST', season: 2026 } });
    await screen.rerender(<Probe />);
    expect(screen.getByText('waiting')).toBeTruthy();
    mockEvent({ start: '2026-11-10', end: '2026-11-11' });
    await screen.rerender(<Probe />);
    expect(screen.getByText('/competition')).toBeTruthy();
    expect(useFTCScoutEvent).toHaveBeenLastCalledWith('CAONTEST', 2026);
    await screen.unmount();
  });

  it('does not treat a configured but future event as active', async () => {
    mockEvent({ start: '2026-11-11', end: '2026-11-12' });
    const screen = await render(<Probe />);
    expect(screen.getByText('/dashboard')).toBeTruthy();
    await screen.unmount();
  });

  it('falls back to Dashboard after a settings failure or when no event is configured', async () => {
    for (const data of [undefined, null, { value: {} }]) {
      mockSetting(data);
      mockEvent(undefined, true);
      const screen = await render(<Probe />);
      expect(screen.getByText('/dashboard')).toBeTruthy();
      await screen.unmount();
    }
  });

  it('falls back to Dashboard after the event request fails', async () => {
    mockEvent(undefined, false);
    const screen = await render(<Probe />);
    expect(screen.getByText('/dashboard')).toBeTruthy();
    await screen.unmount();
  });

  it('skips event lookups for demo mode and opens Dashboard immediately', async () => {
    jest.mocked(useAuth).mockReturnValue({ isDemo: true } as ReturnType<typeof useAuth>);
    mockSetting(undefined, true);
    mockEvent(undefined, true);
    const screen = await render(<Probe />);
    expect(screen.getByText('/dashboard')).toBeTruthy();
    expect(useAppSetting).toHaveBeenLastCalledWith('active_event', { enabled: false });
    expect(useFTCScoutEvent).toHaveBeenLastCalledWith('', 2026);
    await screen.unmount();
  });

  it('does not request settings or redirect when visiting an explicit page or awaiting approval', async () => {
    const screen = await render(<Probe enabled={false} />);
    expect(screen.getByText('waiting')).toBeTruthy();
    expect(useAppSetting).toHaveBeenLastCalledWith('active_event', { enabled: false });
    expect(useFTCScoutEvent).toHaveBeenLastCalledWith('', 2026);
    await screen.unmount();
  });
});
