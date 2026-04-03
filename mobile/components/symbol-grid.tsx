import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";

const CHARS = ["·", "♡", "✦", "○", "♥", "+", "△", "◇", "★", "◦"];
const CELL = 22;
const FONT_SIZE = 9;
const BASE_ALPHA = 0.06;

/** How many characters twinkle at once. */
const TWINKLE_COUNT = 16;
/** Seconds between twinkle waves. */
const WAVE_INTERVAL = 2800;
/** Peak opacity when a character "catches light". */
const TWINKLE_PEAK = 0.32;
/** Duration of a single twinkle up+down (ms). */
const TWINKLE_DURATION = 1400;

type StaticCell = {
  key: string;
  char: string;
  x: number;
  y: number;
  opacity: number;
};

/**
 * A single animated character that twinkles — fades from base to bright and back.
 * Uses Reanimated so animation runs on the UI thread.
 */
function TwinkleChar({
  char,
  x,
  y,
  delay,
}: {
  char: string;
  x: number;
  y: number;
  delay: number;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(TWINKLE_PEAK, {
          duration: TWINKLE_DURATION * 0.4,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: TWINKLE_DURATION * 0.6,
          easing: Easing.in(Easing.cubic),
        }),
      ),
    );
  }, [delay, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        {
          position: "absolute",
          left: x - CELL / 2,
          top: y - CELL / 2,
          width: CELL,
          height: CELL,
          fontSize: FONT_SIZE,
          lineHeight: CELL,
          textAlign: "center" as const,
          color: "#FFFFFF",
        },
        animStyle,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

/**
 * A wave of twinkles that emanates outward from a random origin point.
 * Characters closer to the origin twinkle first, creating a ripple effect.
 */
function TwinkleWave({
  cells,
  waveKey,
  width,
  height,
}: {
  cells: StaticCell[];
  waveKey: number;
  width: number;
  height: number;
}) {
  const selected = useMemo(() => {
    // Random origin point for the ripple
    const originX = Math.random() * width;
    const originY = Math.random() * height * 0.7 + height * 0.1;

    // Only consider cells with visible opacity (not edge-faded to zero)
    const visible = cells.filter((c) => c.opacity > 0.02);
    if (visible.length === 0) return [];

    // Sort by distance from origin
    const withDist = visible.map((c) => ({
      ...c,
      dist: Math.sqrt((c.x - originX) ** 2 + (c.y - originY) ** 2),
    }));
    withDist.sort((a, b) => a.dist - b.dist);

    // Pick a cluster near the origin — the ripple's "splash zone"
    const maxRadius = Math.min(width, height) * 0.45;
    const inRadius = withDist.filter((c) => c.dist < maxRadius);

    // Sample evenly across the radius for a ripple feel
    const count = Math.min(TWINKLE_COUNT, inRadius.length);
    const step = Math.max(1, Math.floor(inRadius.length / count));
    const picked: (StaticCell & { dist: number })[] = [];
    for (let i = 0; i < inRadius.length && picked.length < count; i += step) {
      picked.push(inRadius[i]);
    }

    // Delay based on distance from origin — closer = earlier = ripple
    const maxDist = picked.length > 0 ? picked[picked.length - 1].dist : 1;
    return picked.map((c) => ({
      ...c,
      delay: (c.dist / maxDist) * 800, // 0-800ms stagger
    }));
  }, [waveKey, cells, width, height]);

  return (
    <View pointerEvents="none" className="absolute inset-0">
      {selected.map((c) => (
        <TwinkleChar
          key={`${waveKey}-${c.key}`}
          char={c.char}
          x={c.x}
          y={c.y}
          delay={c.delay}
        />
      ))}
    </View>
  );
}

/**
 * Static character grid with animated twinkle waves.
 * Matches the web hero's SocialGrid, adapted for touch — no hover,
 * instead characters periodically catch light in rippling waves.
 */
export function SymbolGrid() {
  const { width, height } = useWindowDimensions();
  const [waveKey, setWaveKey] = React.useState(0);

  const cells = useMemo(() => {
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const result: StaticCell[] = [];

    const fadeTop = height * 0.05;
    const fadeBottom = height * 0.35;
    const fadeSide = width * 0.08;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL + CELL / 2;
        const y = r * CELL + CELL / 2;

        let edge = 1;
        if (y < fadeTop) edge *= y / fadeTop;
        if (y > height - fadeBottom) edge *= (height - y) / fadeBottom;
        if (x < fadeSide) edge *= x / fadeSide;
        if (x > width - fadeSide) edge *= (width - x) / fadeSide;
        edge = Math.max(0, Math.min(1, edge));

        const opacity = BASE_ALPHA * edge;
        if (opacity < 0.005) continue;

        result.push({
          key: `${r}-${c}`,
          char: CHARS[(r * 7 + c * 13) % CHARS.length],
          x,
          y,
          opacity,
        });
      }
    }

    return result;
  }, [width, height]);

  // Trigger new twinkle waves on an interval
  useEffect(() => {
    // First wave after a short delay
    const initialTimeout = setTimeout(() => {
      setWaveKey(1);
    }, 1200);

    const interval = setInterval(() => {
      setWaveKey((k) => k + 1);
    }, WAVE_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <View pointerEvents="none" className="absolute inset-0" style={{ overflow: "hidden" }}>
      {/* Static base grid */}
      {cells.map((cell) => (
        <Text
          key={cell.key}
          style={{
            position: "absolute",
            left: cell.x - CELL / 2,
            top: cell.y - CELL / 2,
            width: CELL,
            height: CELL,
            fontSize: FONT_SIZE,
            lineHeight: CELL,
            textAlign: "center",
            color: `rgba(255,255,255,${cell.opacity})`,
          }}
        >
          {cell.char}
        </Text>
      ))}

      {/* Animated twinkle wave */}
      {waveKey > 0 ? (
        <TwinkleWave
          cells={cells}
          waveKey={waveKey}
          width={width}
          height={height}
        />
      ) : null}
    </View>
  );
}
