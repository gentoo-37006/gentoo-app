import * as React from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BatteryMedium,
  CircleStop,
  EllipsisVertical,
  Gamepad2,
  LayoutDashboard,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Save,
  Settings2,
  Wifi,
  X,
} from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { FadeModal } from '@/components/ui/fade-modal';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  describeConnectionHealth,
  describeRobotState,
  driverStationCompatibilityLabel,
  type DriverStationSnapshot,
  type OpMode,
} from '@/lib/driver-station/client';
import {
  listHardwareNames,
  renameHardware,
  validateHardwareNames,
  type HardwareName,
} from '@/lib/driver-station/hardware-config';
import { STOP_OP_MODE } from '@/lib/driver-station/protocol';
import { useDriverStation } from '@/lib/driver-station/use-driver-station';
import { ControllerPanel, type ControllerPanelHandle } from '@/components/driver-station/controller-panel';
import { controllerPressHaptic } from '@/lib/driver-station/haptics';

type DriverStationTab = 'control' | 'controller' | 'hardware';

function StatusDot({ status }: { status: DriverStationSnapshot['status'] }) {
  return (
    <View
      className={cn(
        'h-2 w-2 rounded-full',
        status === 'connected'
          ? 'bg-success'
          : status === 'error'
            ? 'bg-destructive'
            : 'bg-warning'
      )}
    />
  );
}

function HeaderMetric({
  icon,
  label,
  value,
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
}) {
  return (
    <View className="min-w-24 flex-row items-center gap-2 border-l border-border px-3">
      <Icon as={icon} size={17} className="text-muted-foreground" />
      <View>
        <Text className="text-[10px] font-semibold uppercase text-muted-foreground">
          {label}
        </Text>
        <Text className="text-xs font-bold" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DriverStationHeader({
  snapshot,
  onBack,
  onConfiguration,
  onRestart,
  controllerView,
  onToggleController,
}: {
  snapshot: DriverStationSnapshot;
  onBack: () => void;
  onConfiguration: () => void;
  onRestart: () => void;
  controllerView: boolean;
  onToggleController: () => void;
}) {
  const connected = snapshot.status === 'connected';
  const canRestart = connected && snapshot.activeOpMode === STOP_OP_MODE;
  const [connectionDetailsOpen, setConnectionDetailsOpen] = React.useState(false);
  return (
    <View
      className="h-14 flex-row items-center border-b border-border bg-card px-6"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave Driver Station"
        onPress={onBack}
        className="h-10 w-10 items-center justify-center rounded-sm active:bg-accent"
      >
        <Icon as={ArrowLeft} size={21} className="text-foreground" />
      </Pressable>
      <View className="ml-1 mr-4">
        <Text className="text-base font-extrabold">Driver Station</Text>
        <Text className="text-[10px] text-muted-foreground">
          {driverStationCompatibilityLabel}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Connection details"
        onPress={() => setConnectionDetailsOpen(true)}
        className="min-w-0 flex-1 flex-row items-center gap-2"
      >
        <StatusDot status={snapshot.status} />
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-bold" numberOfLines={1}>
            {snapshot.statusMessage}
          </Text>
          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
            {snapshot.peerHost ?? 'Join the Control Hub Wi-Fi network'}
          </Text>
        </View>
      </Pressable>

      <FadeModal visible={connectionDetailsOpen} onRequestClose={() => setConnectionDetailsOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 p-4" onPress={() => setConnectionDetailsOpen(false)}>
          <Pressable className="max-h-full w-full max-w-xl rounded-sm border border-border bg-popover p-4" onPress={() => {}}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold">Connection details</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close connection details" className="h-10 w-10 items-center justify-center rounded-sm active:bg-accent" onPress={() => setConnectionDetailsOpen(false)}>
                <Icon as={X} size={20} className="text-foreground" />
              </Pressable>
            </View>
            <ScrollView>
              <Text className="text-sm" selectable>{snapshot.statusMessage}</Text>
              <Text className="mt-3 text-xs text-muted-foreground" selectable>
                {snapshot.peerHost ? `Control Hub: ${snapshot.peerHost}:20884` : 'Searching: 192.168.43.1:20884, 192.168.49.1:20884'}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </FadeModal>

      <HeaderMetric
        icon={Wifi}
        label="Link"
        value={
          snapshot.latencyMs === null
            ? describeConnectionHealth(snapshot)
            : `${describeConnectionHealth(snapshot)} | ${snapshot.latencyMs} ms`
        }
      />
      <HeaderMetric
        icon={BatteryMedium}
        label="Robot"
        value={snapshot.batteryVoltage === null ? 'Unavailable' : `${snapshot.batteryVoltage.toFixed(2)} V`}
      />
      <HeaderMetric
        icon={Activity}
        label="State"
        value={describeRobotState(snapshot.robotState)}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={controllerView ? 'Show Driver Station' : 'Show controller'}
        onPress={onToggleController}
        className="h-11 w-11 items-center justify-center rounded-sm active:bg-accent"
      >
        <Icon as={controllerView ? LayoutDashboard : Gamepad2} size={22} className="text-foreground" />
      </Pressable>
      <DriverStationMenu
        canRestart={canRestart}
        onConfiguration={onConfiguration}
        onRestart={onRestart}
      />
    </View>
  );
}

function DriverStationMenu({
  canRestart,
  onConfiguration,
  onRestart,
}: {
  canRestart: boolean;
  onConfiguration: () => void;
  onRestart: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ right: number; top: number } | null>(null);
  const triggerRef = React.useRef<View>(null);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPosition({
        right: Math.max(4, Dimensions.get('window').width - x - width),
        top: y + height + 4,
      });
      setOpen(true);
    });
  };

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Driver Station menu"
        onPress={openMenu}
        className="ml-1 h-11 w-11 items-center justify-center rounded-sm active:bg-accent"
      >
        <Icon as={EllipsisVertical} size={22} className="text-foreground" />
      </Pressable>
      {position ? (
        <FadeModal
          visible={open}
          onRequestClose={() => setOpen(false)}
          onDismiss={() => setPosition(null)}
        >
          <Pressable className="flex-1" onPress={() => setOpen(false)}>
            <View
              className="absolute w-56 overflow-hidden rounded-sm border border-border bg-popover p-1"
              style={position}
            >
              <Pressable
                className="h-11 flex-row items-center gap-3 rounded-sm px-3 active:bg-accent"
                onPress={() => {
                  setOpen(false);
                  onConfiguration();
                }}
              >
                <Icon as={Settings2} size={18} className="text-muted-foreground" />
                <Text className="text-sm font-semibold">Robot configuration</Text>
              </Pressable>
              <Pressable
                disabled={!canRestart}
                className={cn(
                  'h-11 flex-row items-center gap-3 rounded-sm px-3 active:bg-accent',
                  !canRestart && 'opacity-35'
                )}
                onPress={() => {
                  setOpen(false);
                  onRestart();
                }}
              >
                <Icon as={RotateCw} size={18} className="text-muted-foreground" />
                <Text className="text-sm font-semibold">Restart robot</Text>
              </Pressable>
            </View>
          </Pressable>
        </FadeModal>
      ) : null}
    </View>
  );
}

function OpModeLabel({ opMode }: { opMode: OpMode }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
        {opMode.name}
      </Text>
      <Text className="text-[10px] font-semibold text-muted-foreground">
        {opMode.flavor === 'AUTONOMOUS'
          ? 'AUTO'
          : opMode.flavor === 'TELEOP'
            ? 'TELEOP'
            : opMode.flavor}
      </Text>
    </View>
  );
}

function SystemMessages({ snapshot }: { snapshot: DriverStationSnapshot }) {
  if (!snapshot.error && !snapshot.warning) return null;
  return (
    <View className="gap-2">
      {snapshot.error ? (
        <View className="flex-row gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2.5">
          <Icon as={AlertTriangle} size={17} className="mt-0.5 text-destructive" />
          <Text className="flex-1 text-xs text-destructive" numberOfLines={5}>
            {snapshot.error}
          </Text>
        </View>
      ) : null}
      {snapshot.warning ? (
        <View className="flex-row gap-2 rounded-sm border border-warning/50 bg-warning/10 p-2.5">
          <Icon as={AlertTriangle} size={17} className="mt-0.5 text-warning-foreground" />
          <Text className="flex-1 text-xs" numberOfLines={5}>
            {snapshot.warning}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function getOpModeAction({
  snapshot,
  selectedOpMode,
  onInit,
  onStart,
  onStop,
}: {
  snapshot: DriverStationSnapshot;
  selectedOpMode: string | null;
  onInit: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const connected = snapshot.status === 'connected';
  const selected = snapshot.opModes.find((opMode) => opMode.name === selectedOpMode);
  const canStart =
    connected &&
    selected !== undefined &&
    snapshot.activeOpMode === selected.name &&
    snapshot.opModePhase === 'init';
  const canStop = connected && snapshot.activeOpMode !== STOP_OP_MODE;
  const action = canStop
    ? snapshot.opModePhase === 'running'
      ? {
          label: 'STOP',
          icon: CircleStop,
          enabled: true,
          className: 'bg-destructive',
          iconClassName: 'text-destructive-foreground',
          textClassName: 'text-destructive-foreground',
          onPress: onStop,
        }
      : {
          label: 'START',
          icon: Play,
          enabled: canStart,
          className: 'bg-success',
          iconClassName: 'text-success-foreground',
          textClassName: 'text-success-foreground',
          onPress: onStart,
        }
    : {
        label: 'INIT',
        icon: Power,
        enabled: connected && selected !== undefined,
        className: 'bg-secondary',
        iconClassName: 'text-secondary-foreground',
        textClassName: 'text-secondary-foreground',
        onPress: onInit,
      };
  return action;
}

function ControlPanel(props: {
  snapshot: DriverStationSnapshot;
  selectedOpMode: string | null;
  onSelect: (name: string) => void;
  onInit: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const { snapshot, selectedOpMode, onSelect } = props;
  const connected = snapshot.status === 'connected';
  const action = getOpModeAction(props);
  const options = snapshot.opModes.map((opMode) => ({
    value: opMode.name,
    label: opMode.name,
  }));

  return (
    <View className="w-[46%] min-w-72 border-r border-border">
      <View className="border-b border-border p-3">
        <Text className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">OpMode</Text>
        <Select
          options={options}
          value={selectedOpMode}
          onChange={onSelect}
          placeholder={connected ? 'Select an OpMode...' : 'Waiting for Control Hub...'}
          renderValue={(option) => {
            const opMode = snapshot.opModes.find((item) => item.name === option.value);
            return opMode ? <OpModeLabel opMode={opMode} /> : null;
          }}
        />
      </View>

      <View className="border-b border-border bg-card px-3 py-2.5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase text-muted-foreground">
              Active
            </Text>
            <Text className="text-sm font-bold" numberOfLines={1}>
              {snapshot.activeOpMode === STOP_OP_MODE ? 'No OpMode running' : snapshot.activeOpMode}
            </Text>
          </View>
          <View className="rounded-sm bg-muted px-2 py-1">
            <Text className="text-[10px] font-bold uppercase">
              {snapshot.opModePhase}
            </Text>
          </View>
        </View>
      </View>

      <View className="min-h-32 flex-1 items-center justify-center p-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          disabled={!action.enabled}
          onPress={action.onPress}
          className={cn(
            'h-28 w-28 items-center justify-center rounded-full border-4 border-background active:opacity-85',
            action.className,
            !action.enabled && 'opacity-40'
          )}
        >
          <Icon as={action.icon} size={27} className={action.iconClassName} />
          <Text className={cn('mt-1 text-base font-extrabold', action.textClassName)}>
            {action.label}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="max-h-24 px-3 pb-3" showsVerticalScrollIndicator={false}>
        <SystemMessages snapshot={snapshot} />
      </ScrollView>
    </View>
  );
}

function TelemetryPanel({ snapshot }: { snapshot: DriverStationSnapshot }) {
  return (
    <View className="min-w-0 flex-1">
      <View className="h-10 flex-row items-center justify-between border-b border-border bg-card px-3">
        <Text className="text-sm font-bold">Telemetry</Text>
        <Text className="text-[10px] text-muted-foreground">
          {snapshot.telemetry.length} values
        </Text>
      </View>
      <ScrollView className="flex-1">
        {snapshot.telemetry.map((entry, index) => (
          <View
            key={`${entry.key}-${index}`}
            className={cn(
              'min-h-10 flex-row items-center gap-4 px-3 py-2',
              index > 0 && 'border-t border-border'
            )}
          >
            <Text className="w-[38%] text-xs font-semibold text-muted-foreground" numberOfLines={1}>
              {entry.key || `Line ${index + 1}`}
            </Text>
            <Text className="flex-1 text-xs font-medium" selectable>
              {typeof entry.value === 'number' ? entry.value.toFixed(4) : entry.value}
            </Text>
          </View>
        ))}
        {snapshot.telemetry.length === 0 ? (
          <View className="items-center justify-center px-4 py-16">
            <Text className="text-sm font-semibold text-muted-foreground">
              {snapshot.status === 'connected' ? 'No telemetry received' : 'Waiting for a Control Hub'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function HardwareRow({
  item,
  value,
  onChange,
}: {
  item: HardwareName;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
      <View style={{ width: Math.min(item.depth * 12, 48) }} />
      <View className="w-40">
        <Text className="text-xs font-bold" numberOfLines={1}>
          {item.tag}
        </Text>
        <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
          {item.port ? `Port ${item.port}` : item.serialNumber ?? 'Controller'}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        selectTextOnFocus
        autoCorrect={false}
        className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background px-3 text-sm font-medium text-foreground"
        placeholder="Hardware name"
        placeholderTextColor="hsl(0 0% 47%)"
      />
    </View>
  );
}

function HardwarePanel({
  snapshot,
  onRefresh,
  onSave,
}: {
  snapshot: DriverStationSnapshot;
  onRefresh: () => void;
  onSave: (xml: string) => void;
}) {
  const sourceXml = snapshot.hardwareXml;
  const parsedHardware = React.useMemo(() => {
    if (!sourceXml) return { hardware: [] as HardwareName[], error: null as string | null };
    try {
      return { hardware: listHardwareNames(sourceXml), error: null };
    } catch (error) {
      return {
        hardware: [] as HardwareName[],
        error: error instanceof Error ? error.message : 'Unable to read the robot configuration.',
      };
    }
  }, [sourceXml]);
  const hardware = parsedHardware.hardware;
  const [draftNames, setDraftNames] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(hardware.map((item) => [item.id, item.name]))
  );
  const [validationMessage, setValidationMessage] = React.useState<string | null>(
    parsedHardware.error
  );

  const dirty = hardware.some((item) => draftNames[item.id] !== item.name);

  const save = () => {
    if (!sourceXml) return;
    try {
      let nextXml = sourceXml;
      hardware.forEach((item) => {
        const nextName = draftNames[item.id] ?? '';
        if (nextName !== item.name) nextXml = renameHardware(nextXml, item.id, nextName);
      });
      const validation = validateHardwareNames(nextXml);
      if (validation) {
        setValidationMessage(validation);
        return;
      }
      setValidationMessage(null);
      Alert.alert(
        'Save hardware names?',
        'The robot must be restarted before the new names are used.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => onSave(nextXml) },
        ]
      );
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Unable to save hardware names.');
    }
  };

  return (
    <View className="flex-1 p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-bold">
            {snapshot.activeConfiguration?.name ?? 'No active configuration'}
          </Text>
          <Text className="text-[10px] text-muted-foreground">
            {hardware.length} named hardware devices
          </Text>
        </View>
        <Button
          size="sm"
          variant="outline"
          icon={RefreshCw}
          label="Reload"
          disabled={snapshot.status !== 'connected' || !snapshot.activeConfiguration}
          onPress={onRefresh}
        />
        <Button
          size="sm"
          icon={Save}
          label="Save names"
          loading={snapshot.configurationSaving}
          disabled={!dirty || Boolean(validationMessage)}
          onPress={save}
        />
      </View>

      {validationMessage ? (
        <View className="mb-2 flex-row items-center gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2">
          <Icon as={AlertTriangle} size={16} className="text-destructive" />
          <Text className="flex-1 text-xs text-destructive">{validationMessage}</Text>
        </View>
      ) : null}
      {snapshot.configurationMessage ? (
        <View className="mb-2 rounded-sm border border-border bg-muted px-3 py-2">
          <Text className="text-xs font-medium">{snapshot.configurationMessage}</Text>
        </View>
      ) : null}

      <ScrollView className="flex-1 rounded-sm border border-border bg-card" keyboardShouldPersistTaps="handled">
        {hardware.map((item) => (
          <HardwareRow
            key={item.id}
            item={item}
            value={draftNames[item.id] ?? ''}
            onChange={(value) => {
              setDraftNames((current) => ({ ...current, [item.id]: value }));
              setValidationMessage(null);
            }}
          />
        ))}
        {hardware.length === 0 ? (
          <View className="items-center justify-center px-4 py-12">
            <Text className="text-sm font-semibold text-muted-foreground">
              {snapshot.status === 'connected'
                ? 'Loading the active hardware configuration...'
                : 'Connect to a Control Hub to edit hardware names'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function NativeDriverStation() {
  const router = useRouter();
  const { client, snapshot } = useDriverStation();
  const [tab, setTab] = React.useState<DriverStationTab>('control');
  const [selectedOpMode, setSelectedOpMode] = React.useState<string | null>(null);
  const [gamepadUser, setGamepadUser] = React.useState<1 | 2>(1);
  const controllerRef = React.useRef<ControllerPanelHandle>(null);
  const resetWhenNoTouches = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length === 0) controllerRef.current?.resetTouches();
  };
  const effectiveSelectedOpMode =
    selectedOpMode && snapshot.opModes.some((opMode) => opMode.name === selectedOpMode)
      ? selectedOpMode
      : snapshot.opModes[0]?.name ?? null;

  const leave = () => {
    client.stopOpMode();
    router.back();
  };

  const changeTab = (next: DriverStationTab) => {
    client.setControllerEnabled(false);
    setTab(next);
  };
  const action = getOpModeAction({
    snapshot,
    selectedOpMode: effectiveSelectedOpMode,
    onInit: () => effectiveSelectedOpMode && client.initOpMode(effectiveSelectedOpMode),
    onStart: () => effectiveSelectedOpMode && client.startOpMode(effectiveSelectedOpMode),
    onStop: () => client.stopOpMode(),
  });

  const restart = () => {
    Alert.alert(
      'Restart robot?',
      'The Control Hub Robot Controller will restart and briefly disconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', style: 'destructive', onPress: () => client.restartRobot() },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background" onTouchEnd={resetWhenNoTouches} onTouchCancel={resetWhenNoTouches} onTouchMove={resetWhenNoTouches}>
      <StatusBar hidden />
      <DriverStationHeader
        snapshot={snapshot}
        onBack={tab === 'hardware' ? () => changeTab('control') : leave}
        onConfiguration={() => changeTab('hardware')}
        controllerView={tab === 'controller'}
        onToggleController={() => changeTab(tab === 'controller' ? 'control' : 'controller')}
        onRestart={restart}
      />
      <SafeAreaView className="flex-1" edges={tab === 'controller' ? [] : ['left']}>
        {tab === 'control' ? (
          <View className="min-w-0 flex-1 flex-row">
            <ControlPanel
              snapshot={snapshot}
              selectedOpMode={effectiveSelectedOpMode}
              onSelect={setSelectedOpMode}
              onInit={() => effectiveSelectedOpMode && client.initOpMode(effectiveSelectedOpMode)}
              onStart={() => effectiveSelectedOpMode && client.startOpMode(effectiveSelectedOpMode)}
              onStop={() => client.stopOpMode()}
            />
            <TelemetryPanel snapshot={snapshot} />
          </View>
        ) : tab === 'controller' ? (
          <ControllerPanel
            ref={controllerRef}
            key={`${snapshot.status}-${snapshot.opModePhase}`}
            client={client}
            gamepadUser={gamepadUser}
            onSelectGamepad={(user) => {
              client.setGamepadUser(user);
              setGamepadUser(user);
            }}
            connected={snapshot.status === 'connected' && snapshot.opModePhase === 'running'}
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                disabled={!action.enabled}
                onPress={() => { controllerPressHaptic(action.label === 'STOP'); action.onPress(); }}
                className={cn('h-12 w-36 flex-row items-center justify-center gap-2 rounded-sm', action.className, !action.enabled && 'opacity-40')}
              >
                <Icon as={action.icon} size={24} className={action.iconClassName} />
                <Text className={cn('text-base font-extrabold', action.textClassName)}>{action.label}</Text>
              </Pressable>
            }
          />
        ) : (
          <HardwarePanel
            key={snapshot.hardwareXml ?? 'no-hardware-configuration'}
            snapshot={snapshot}
            onRefresh={() => client.requestHardwareConfiguration()}
            onSave={(xml) => client.saveHardwareConfiguration(xml)}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

export default function DriverStationRoute() {
  if (Platform.OS === 'web') return <Redirect href="/" />;
  return <NativeDriverStation />;
}
