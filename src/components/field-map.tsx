import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import {
  AUTON_PATH_COLOURS,
  AUTON_PATH_INKS,
  pathData,
  pathLabel,
  pressPoint,
  sketchPath,
  toField,
  toViewport,
  type AutonPath,
  type FieldId,
  type FieldPosition,
} from '@/lib/alliance-card';
import { Text } from '@/components/ui/text';

const FIELD_IMAGES: Record<FieldId, number> = {
  biobuzz: require('../../assets/images/fields/biobuzz.webp'),
  decode: require('../../assets/images/fields/decode.webp'),
  intothedeep: require('../../assets/images/fields/intothedeep.webp'),
  centerstage: require('../../assets/images/fields/centerstage.webp'),
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const BADGE_RADIUS = 10;
/** The badge and its ring: how close its centre may come to the edge of the map. */
const BADGE_EDGE = BADGE_RADIUS + 1;

/** Keeps a start badge whole when its path begins against the field wall. */
const insideMap = (value: number, size: number) =>
  Math.max(BADGE_EDGE, Math.min(size - BADGE_EDGE, value));

/** One path: a white casing so it reads on any part of the field, then the colour. */
function PathMarks({ path, index, size }: { path: AutonPath; index: number; size: number }) {
  const colour = AUTON_PATH_COLOURS[index % AUTON_PATH_COLOURS.length];
  const ink = AUTON_PATH_INKS[index % AUTON_PATH_INKS.length];
  const d = pathData(path, size);
  const start = toViewport(path.curves[0].start, size);
  const end = toViewport(path.curves[path.curves.length - 1].end, size);
  const badge = { x: insideMap(start.x, size), y: insideMap(start.y, size) };
  return (
    <G>
      <Path d={d} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} fill="none" stroke={colour} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={end.x} cy={end.y} r={5} fill={colour} stroke="#ffffff" strokeWidth={2} />
      {/* The number marks where the path starts and ties it to the list below the map. */}
      <Circle cx={badge.x} cy={badge.y} r={BADGE_RADIUS} fill={colour} stroke="#ffffff" strokeWidth={2} />
      <SvgText x={badge.x} y={badge.y + 4} fill={ink} fontSize={11} fontWeight="bold" textAnchor="middle">
        {index + 1}
      </SvgText>
    </G>
  );
}

/**
 * The field with the auton paths drawn on it. With `onTap` it is also the
 * sketching surface: each tap reports the field position it landed on.
 */
export function FieldMap({
  field,
  paths,
  draft,
  onTap,
}: {
  field: FieldId;
  paths: AutonPath[];
  /** Taps of the path being sketched, drawn in the colour it will get. */
  draft?: FieldPosition[];
  onTap?: (position: FieldPosition) => void;
}) {
  const [size, setSize] = React.useState(0);
  const draftPath = draft ? sketchPath('Draft', draft) : null;
  const draftColour = AUTON_PATH_COLOURS[paths.length % AUTON_PATH_COLOURS.length];

  return (
    <View
      className="aspect-square w-full max-w-[520px] self-center overflow-hidden rounded-lg border border-border bg-muted"
      onLayout={(event) => setSize(event.nativeEvent.layout.width)}
    >
      <View style={{ ...FILL, pointerEvents: 'none' }}>
        <Image
          source={FIELD_IMAGES[field]}
          contentFit="fill"
          accessibilityLabel="Field map"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      {size > 0 ? (
        <Svg width={size} height={size} style={{ ...FILL, pointerEvents: 'none' }}>
          {paths.map((path, index) => (
            <PathMarks key={`${index}-${path.name}`} path={path} index={index} size={size} />
          ))}
          {draftPath ? (
            <Path
              d={pathData(draftPath, size)}
              fill="none"
              stroke={draftColour}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {(draft ?? []).map((position, index) => {
            const { x, y } = toViewport(position, size);
            return <Circle key={index} cx={x} cy={y} r={6} fill={draftColour} stroke="#ffffff" strokeWidth={2} />;
          })}
        </Svg>
      ) : null}
      {onTap ? (
        // An empty layer on top, so a tap's position is always measured from
        // the map's own corner and never from a child it happened to land on.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tap the field to add a point"
          style={FILL}
          onPress={(event) => {
            const point = pressPoint(event.nativeEvent, size);
            if (point) onTap(toField(point, size));
          }}
        />
      ) : null}
    </View>
  );
}

/** The list that names each numbered path on the map. */
export function PathLegend({
  paths,
  renderAction,
}: {
  paths: AutonPath[];
  renderAction?: (index: number) => React.ReactNode;
}) {
  return (
    <View className="gap-2">
      {paths.map((path, index) => (
        <View key={`${index}-${path.name}`} className="flex-row items-center gap-3">
          <View
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: AUTON_PATH_COLOURS[index % AUTON_PATH_COLOURS.length] }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: AUTON_PATH_INKS[index % AUTON_PATH_INKS.length] }}
            >
              {index + 1}
            </Text>
          </View>
          <Text className="min-w-0 flex-1">{pathLabel(path, index)}</Text>
          {renderAction ? renderAction(index) : null}
        </View>
      ))}
    </View>
  );
}
