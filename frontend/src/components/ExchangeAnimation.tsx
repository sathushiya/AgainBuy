import React from "react";
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";
import { colors, radius, spacing, typography } from "../theme";

const STAGE_HEIGHT = 230;
const FIGURE_WIDTH = 72;
const FIGURE_HEIGHT = 150;
const GROUND = STAGE_HEIGHT - 26;
const FIGURE_TOP = GROUND - FIGURE_HEIGHT;
const BOX_SIZE = 30;
const BOX_TOP = FIGURE_TOP + 52;
const CYCLE_MS = 7000;
const STEP_MS = 380;
// Shown when the system asks for reduced motion: parcel handed over, payment shown.
const STILL_FRAME = 0.57;

const nativeDriver = Platform.OS !== "web";

/**
 * Onboarding illustration: a buyer and a seller walk in from opposite sides,
 * the buyer shows a "Paid" bank transfer on their phone, the seller hands over
 * the parcel, and they walk back out. Loops; respects "reduce motion".
 */
export function ExchangeAnimation() {
  const [width, setWidth] = React.useState(320);
  const time = React.useRef(new Animated.Value(0)).current;
  const step = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let cycle: Animated.CompositeAnimation | undefined;
    let walk: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        time.setValue(STILL_FRAME);
        return;
      }
      cycle = Animated.loop(Animated.timing(time, { toValue: 1, duration: CYCLE_MS, easing: Easing.linear, useNativeDriver: nativeDriver }));
      walk = Animated.loop(Animated.timing(step, { toValue: 1, duration: STEP_MS, easing: Easing.linear, useNativeDriver: nativeDriver }));
      cycle.start();
      walk.start();
    });
    return () => { cancelled = true; cycle?.stop(); walk?.stop(); };
  }, [time, step]);

  const motion = React.useMemo(() => {
    const meetLeft = width / 2 - FIGURE_WIDTH - 13;
    const meetRight = width / 2 + 13;
    const offLeft = -FIGURE_WIDTH - 8;
    const offRight = width + 24;
    const at = (input: number[], output: number[]) => time.interpolate({ inputRange: input, outputRange: output, extrapolate: "clamp" });

    // 0–0.25 walk in · 0.27–0.60 phone shows "Paid" · 0.42–0.55 parcel handed over · 0.64 turn · 0.66–0.90 walk out · pause
    const walking = at([0, 0.25, 0.26, 0.655, 0.665, 0.9, 0.91, 1], [1, 1, 0, 0, 1, 1, 0, 0]);
    const bob = Animated.multiply(step.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] }), walking);
    const sway = Animated.multiply(step.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 3, -3, 0] }), walking);
    return {
      buyerX: at([0, 0.25, 0.66, 0.9, 1], [offLeft, meetLeft, meetLeft, offLeft, offLeft]),
      sellerX: at([0, 0.25, 0.66, 0.9, 1], [offRight, meetRight, meetRight, offRight, offRight]),
      // Facing each other, then turning back the way they came.
      buyerFacing: at([0, 0.635, 0.645, 1], [1, 1, -1, -1]),
      sellerFacing: at([0, 0.635, 0.645, 1], [-1, -1, 1, 1]),
      bob,
      sway: sway.interpolate({ inputRange: [-3, 3], outputRange: ["-3deg", "3deg"] }),
      // The parcel: in the seller's hands, handed across, then carried off by the buyer.
      boxX: at([0, 0.25, 0.42, 0.55, 0.62, 0.66, 0.9, 1], [offRight - 14, meetRight - 14, meetRight - 14, meetLeft + FIGURE_WIDTH - 16, meetLeft + FIGURE_WIDTH - 16, meetLeft + FIGURE_WIDTH / 2 - BOX_SIZE / 2, offLeft + FIGURE_WIDTH / 2 - BOX_SIZE / 2, offLeft + FIGURE_WIDTH / 2 - BOX_SIZE / 2]),
      // Lifted across, then held lower so the buyer's phone stays visible.
      boxLift: at([0.42, 0.485, 0.55, 1], [0, -10, 14, 14]),
      paidX: meetLeft + FIGURE_WIDTH - 34,
      paidOpacity: at([0.26, 0.3, 0.58, 0.62], [0, 1, 1, 0]),
      paidScale: at([0.26, 0.3, 0.32], [0.4, 1.08, 1]),
      doneX: width / 2 - 14,
      doneOpacity: at([0.54, 0.57, 0.63, 0.66], [0, 1, 1, 0]),
      doneScale: at([0.54, 0.58], [0.5, 1]),
    };
  }, [width, time, step]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    if (measured > 0 && measured !== width) setWidth(measured);
  };

  return <View
    onLayout={onLayout}
    style={styles.stage}
    accessible
    accessibilityRole="image"
    accessibilityLabel="A buyer and a seller meet. The buyer shows a bank transfer marked Paid on their phone, the seller hands over the item, and both walk away happy.">
    <View style={styles.sun}/>
    <View style={styles.ground}/>

    <Animated.View style={[styles.figure, { transform: [{ translateX: motion.buyerX }, { translateY: motion.bob }, { rotate: motion.sway }, { scaleX: motion.buyerFacing }] }]}>
      <Person shirt={colors.terracotta} skin="#E8B48C" hair="#3B2A20" holdingPhone/>
    </Animated.View>
    <Animated.View style={[styles.figure, { transform: [{ translateX: motion.sellerX }, { translateY: motion.bob }, { rotate: motion.sway }, { scaleX: motion.sellerFacing }] }]}>
      <Person shirt={colors.green} skin="#B9805A" hair="#1F1A17"/>
    </Animated.View>

    <Animated.View style={[styles.box, { transform: [{ translateX: motion.boxX }, { translateY: Animated.add(motion.boxLift, motion.bob) }] }]}>
      <Parcel/>
    </Animated.View>

    <Animated.View style={[styles.paid, { opacity: motion.paidOpacity, transform: [{ translateX: motion.paidX }, { scale: motion.paidScale }] }]}>
      <Text style={styles.paidCheck}>✓</Text>
      <View><Text style={styles.paidTitle}>Paid</Text><Text style={styles.paidSub}>Bank transfer</Text></View>
    </Animated.View>

    <Animated.View style={[styles.done, { opacity: motion.doneOpacity, transform: [{ translateX: motion.doneX }, { scale: motion.doneScale }] }]}>
      <Text style={styles.doneText}>✓</Text>
    </Animated.View>
  </View>;
}

/** A simple person facing right. The buyer holds a phone out in front. */
function Person({ shirt, skin, hair, holdingPhone = false }: { shirt: string; skin: string; hair: string; holdingPhone?: boolean }) {
  return <Svg width={FIGURE_WIDTH} height={FIGURE_HEIGHT} viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}>
    {/* back arm */}
    <Line x1={27} y1={50} x2={20} y2={82} stroke={shirt} strokeWidth={9} strokeLinecap="round"/>
    <Circle cx={20} cy={84} r={4.5} fill={skin}/>
    {/* legs and shoes */}
    <Rect x={25} y={88} width={10} height={50} rx={5} fill={colors.charcoal}/>
    <Rect x={38} y={88} width={10} height={50} rx={5} fill="#3D3D3D"/>
    <Ellipse cx={32} cy={140} rx={9} ry={4.5} fill={colors.charcoal}/>
    <Ellipse cx={46} cy={140} rx={9} ry={4.5} fill={colors.charcoal}/>
    {/* body */}
    <Rect x={20} y={40} width={34} height={54} rx={13} fill={shirt}/>
    {/* head */}
    <Rect x={31} y={32} width={10} height={10} rx={3} fill={skin}/>
    <Circle cx={36} cy={22} r={16} fill={skin}/>
    <Path d="M20 21 C20 8 30 4 37 4 C46 4 53 10 52 19 C47 15 41 13 33 14 C27 15 23 18 20 21 Z" fill={hair}/>
    <Circle cx={44} cy={23} r={1.8} fill={colors.charcoal}/>
    <Path d="M41 30 Q45 32.5 48 29.5" stroke={colors.charcoal} strokeWidth={1.6} fill="none" strokeLinecap="round"/>
    {/* front arm, reaching forward */}
    <Line x1={46} y1={50} x2={62} y2={63} stroke={shirt} strokeWidth={9} strokeLinecap="round"/>
    <Circle cx={63} cy={64} r={4.5} fill={skin}/>
    {holdingPhone && <>
      <Rect x={58} y={48} width={12} height={20} rx={2.5} fill={colors.charcoal}/>
      <Rect x={60} y={51} width={8} height={12} rx={1} fill="#BFE3CF"/>
      <Path d="M61.5 57 L63.5 59 L66.5 54.5" stroke={colors.green} strokeWidth={1.4} fill="none" strokeLinecap="round"/>
    </>}
  </Svg>;
}

function Parcel() {
  return <Svg width={BOX_SIZE} height={BOX_SIZE} viewBox="0 0 30 30">
    <Rect x={1} y={5} width={28} height={23} rx={3} fill="#D9A066"/>
    <Rect x={1} y={5} width={28} height={7} rx={3} fill="#C98F55"/>
    <Rect x={12.5} y={5} width={5} height={23} fill={colors.terracotta}/>
    <Path d="M6 22 C8 18 11 18 12 20" stroke={colors.green} strokeWidth={1.6} fill="none" strokeLinecap="round"/>
  </Svg>;
}

const styles = StyleSheet.create({
  stage: { width: "100%", height: STAGE_HEIGHT, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  sun: { position: "absolute", top: 22, right: 28, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.creamSecondary },
  ground: { position: "absolute", left: spacing.md, right: spacing.md, top: GROUND + 1, height: 3, borderRadius: 2, backgroundColor: colors.creamSecondary },
  figure: { position: "absolute", left: 0, top: FIGURE_TOP, width: FIGURE_WIDTH, height: FIGURE_HEIGHT },
  box: { position: "absolute", left: 0, top: BOX_TOP, width: BOX_SIZE, height: BOX_SIZE },
  paid: { position: "absolute", left: 0, top: FIGURE_TOP - 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.green },
  paidCheck: { ...typography.medium, color: colors.green, fontWeight: "800" },
  paidTitle: { ...typography.caption, color: colors.green, fontWeight: "800", lineHeight: 15 },
  paidSub: { ...typography.label, color: colors.textSecondary, fontSize: 10, lineHeight: 12 },
  done: { position: "absolute", left: 0, top: FIGURE_TOP + 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  doneText: { color: colors.white, fontWeight: "800", fontSize: 15, lineHeight: 18 },
});
