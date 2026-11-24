import React from "react";
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { colors, radius, typography } from "../theme";

// Stage and figure geometry (figures are drawn side-on, facing right).
const STAGE_HEIGHT = 250;
const GROUND = STAGE_HEIGHT - 22;
const FIGURE_WIDTH = 80;
const FIGURE_HEIGHT = 166;
const FIGURE_TOP = GROUND - 164;
const SHOULDER = { x: 41, y: 46 };
const HIP = { x: 41, y: 96 };
const ARM_LENGTH = 58;
const LEG_LENGTH = 72;
const BOX_WIDTH = 32;
const BOX_HEIGHT = 27;

const CYCLE_MS = 8000;
const STRIDE_MS = 760;
// Shown when the system asks for reduced motion: the parcel just handed over, payment showing.
const STILL_FRAME = 0.56;

const nativeDriver = Platform.OS !== "web";

type Look = {
  skin: string; skinShade: string; hair: string;
  shirt: string; shirtShade: string; pants: string; pantsShade: string;
  shoe: string; sole: string; kind: "buyer" | "seller";
};

const BUYER: Look = { skin: "#E9B995", skinShade: "#D49E79", hair: "#3A2418", shirt: colors.terracotta, shirtShade: "#A9543A", pants: "#3B4C6E", pantsShade: "#2C3954", shoe: "#F4F1EC", sole: "#C9C2B8", kind: "buyer" };
const SELLER: Look = { skin: "#B47A55", skinShade: "#9A6443", hair: "#1E1915", shirt: colors.green, shirtShade: "#22603F", pants: "#8E7D63", pantsShade: "#74654F", shoe: "#5E4130", sole: "#3E2B20", kind: "seller" };

type Pose = {
  x: Animated.AnimatedInterpolation<number>;
  facing: Animated.AnimatedInterpolation<number>;
  bob: Animated.AnimatedNode;
  frontArm: Animated.AnimatedInterpolation<string>;
  backArm: Animated.AnimatedInterpolation<string>;
  frontLeg: Animated.AnimatedInterpolation<string>;
  backLeg: Animated.AnimatedInterpolation<string>;
};

/**
 * Onboarding illustration: a buyer and a seller walk in from opposite sides,
 * the buyer raises their phone to show a bank transfer marked Paid, the seller
 * holds out the parcel and the buyer takes it, then both turn and walk away.
 * Loops; shows a still frame when "reduce motion" is on.
 */
export function ExchangeAnimation() {
  const [width, setWidth] = React.useState(340);
  const time = React.useRef(new Animated.Value(0)).current;
  const stride = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        time.setValue(STILL_FRAME);
        return;
      }
      loops = [
        Animated.loop(Animated.timing(time, { toValue: 1, duration: CYCLE_MS, easing: Easing.linear, useNativeDriver: nativeDriver })),
        Animated.loop(Animated.timing(stride, { toValue: 1, duration: STRIDE_MS, easing: Easing.linear, useNativeDriver: nativeDriver })),
      ];
      loops.forEach((loop) => loop.start());
    });
    return () => { cancelled = true; loops.forEach((loop) => loop.stop()); };
  }, [time, stride]);

  const scene = React.useMemo(() => {
    const centre = width / 2;
    // Bodies stand about an arm's length apart, so their hands meet in the middle.
    const meetLeft = centre - 48 - SHOULDER.x;
    const meetRight = centre + 48 - SHOULDER.x;
    const offLeft = -FIGURE_WIDTH - 30;
    const offRight = width + 30;
    const at = (input: number[], output: number[]) => time.interpolate({ inputRange: input, outputRange: output, extrapolate: "clamp" });
    const deg = (node: Animated.AnimatedNode) => (node as Animated.AnimatedInterpolation<number>).interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] });

    // Timeline (0–1): walk in, slowing down · raise phone, "Paid" · parcel held out and taken · turn · walk away, speeding up · pause.
    const walking = at([0, 0.2, 0.26, 0.655, 0.665, 0.72, 0.9, 0.91, 1], [1, 1, 0, 0, 0.6, 1, 1, 0, 0]);
    const swing = Animated.multiply(stride.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 0, -1, 0] }), walking);
    const bob = Animated.multiply(stride.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2.5, 0, -2.5, 0] }), walking);
    const legFront = deg(Animated.multiply(swing, 24));
    const legBack = deg(Animated.multiply(swing, -24));
    const armSwingBack = deg(Animated.multiply(swing, 18));

    // Ease in and out: big steps far away, small ones on arrival.
    const approach = (off: number, meet: number) => at(
      [0, 0.16, 0.22, 0.26, 0.66, 0.7, 0.76, 0.9, 1],
      [off, meet + (off - meet) * 0.22, meet + (off - meet) * 0.04, meet, meet, meet + (off - meet) * 0.03, meet + (off - meet) * 0.2, off, off]);
    const buyerX = approach(offLeft, meetLeft);
    const sellerX = approach(offRight, meetRight);
    const turn = (from: number) => at([0, 0.625, 0.645, 1], [from, from, -from, -from]);

    // The buyer's phone arm: swings while walking in, raises the phone, reaches for the parcel, then carries it.
    const buyerArmAction = at([0, 0.24, 0.3, 0.4, 0.44, 0.47, 0.53, 0.58, 1], [0, 0, -82, -82, -20, -70, -70, -45, -45]);
    const buyerArmSwing = at([0, 0.25, 0.26, 1], [-18, -18, 0, 0]);
    // The seller's front arm: carries the parcel, holds it out, lets go, then swings on the way out.
    const sellerArmAction = at([0, 0.42, 0.47, 0.53, 0.58, 1], [-55, -55, -80, -80, 0, 0]);
    const sellerArmSwing = at([0, 0.575, 0.585, 1], [0, 0, -18, -18]);

    const buyer: Pose = {
      x: buyerX, facing: turn(1), bob,
      frontArm: deg(Animated.add(Animated.multiply(swing, buyerArmSwing), buyerArmAction)),
      backArm: armSwingBack, frontLeg: legFront, backLeg: legBack,
    };
    const seller: Pose = {
      x: sellerX, facing: turn(-1), bob,
      frontArm: deg(Animated.add(Animated.multiply(swing, sellerArmSwing), sellerArmAction)),
      backArm: armSwingBack, frontLeg: legFront, backLeg: legBack,
    };

    // The parcel follows the hands holding it (positions are the parcel's centre).
    const sellerHand = (x: number) => x - 1;
    const buyerCarry = (x: number) => x + 6;
    const boxTimes = [0, 0.16, 0.22, 0.26, 0.42, 0.47, 0.53, 0.58, 0.625, 0.645, 0.66, 0.7, 0.76, 0.9, 1];
    const sellerAt = (t: number) => t <= 0 ? offRight : t <= 0.16 ? meetRight + (offRight - meetRight) * 0.22 : t <= 0.22 ? meetRight + (offRight - meetRight) * 0.04 : meetRight;
    const buyerAt = (fraction: number) => meetLeft + (offLeft - meetLeft) * fraction;
    const boxX = at(boxTimes, [
      sellerHand(sellerAt(0)), sellerHand(sellerAt(0.16)), sellerHand(sellerAt(0.22)), sellerHand(meetRight), sellerHand(meetRight),
      meetRight - 9, meetLeft + 88, meetLeft + 76, meetLeft + 76,
      buyerCarry(meetLeft), buyerCarry(meetLeft), buyerCarry(buyerAt(0.03)), buyerCarry(buyerAt(0.2)), buyerCarry(offLeft), buyerCarry(offLeft),
    ].map((centreX) => centreX - BOX_WIDTH / 2));
    const boxY = at([0, 0.42, 0.47, 0.53, 0.58, 1], [57, 57, 38, 46, 64, 64].map((top) => FIGURE_TOP + top));
    const phoneVisible = at([0, 0.44, 0.47, 0.97, 1], [1, 1, 0, 0, 1]);

    return {
      buyer, seller, boxX, boxY, bob, phoneVisible,
      paidX: meetLeft + 44,
      paidOpacity: at([0.29, 0.32, 0.57, 0.61], [0, 1, 1, 0]),
      paidScale: at([0.29, 0.32, 0.34], [0.5, 1.06, 1]),
      doneX: centre - 15,
      doneOpacity: at([0.53, 0.56, 0.62, 0.65], [0, 1, 1, 0]),
      doneScale: at([0.53, 0.57], [0.4, 1]),
    };
  }, [width, time, stride]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.width);
    if (measured > 0 && measured !== width) setWidth(measured);
  };

  return <View
    onLayout={onLayout}
    style={styles.stage}
    accessible
    accessibilityRole="image"
    accessibilityLabel="A buyer and a seller meet. The buyer shows a bank transfer marked Paid on their phone, the seller hands over the parcel, and both walk away happy.">
    <View style={styles.ground}/>

    <Shadow x={scene.seller.x}/>
    <Shadow x={scene.buyer.x}/>
    <Person look={SELLER} pose={scene.seller}/>
    <Person look={BUYER} pose={scene.buyer} phoneVisible={scene.phoneVisible}/>

    <Animated.View style={[styles.box, { transform: [{ translateX: scene.boxX }, { translateY: Animated.add(scene.boxY, scene.bob) }] }]}>
      <Parcel/>
    </Animated.View>

    <Animated.View style={[styles.paid, { opacity: scene.paidOpacity, transform: [{ translateX: scene.paidX }, { scale: scene.paidScale }] }]}>
      <View style={styles.paidIcon}><Text style={styles.paidCheck}>✓</Text></View>
      <View><Text style={styles.paidTitle}>Paid · LKR 28,500</Text><Text style={styles.paidSub}>Bank transfer</Text></View>
    </Animated.View>

    <Animated.View style={[styles.done, { opacity: scene.doneOpacity, transform: [{ translateX: scene.doneX }, { scale: scene.doneScale }] }]}>
      <Text style={styles.doneText}>✓</Text>
    </Animated.View>
  </View>;
}

function Shadow({ x }: { x: Animated.AnimatedInterpolation<number> }) {
  return <Animated.View style={[styles.shadow, { transform: [{ translateX: x }] }]}/>;
}

/** One person, side-on, facing right; flipped to face left. Arms and legs swing from the shoulder and hip. */
function Person({ look, pose, phoneVisible }: { look: Look; pose: Pose; phoneVisible?: Animated.AnimatedInterpolation<number> }) {
  return <Animated.View style={[styles.figure, { transform: [{ translateX: pose.x }, { translateY: pose.bob }, { scaleX: pose.facing }] }]}>
    <Limb pivot={SHOULDER} width={24} length={ARM_LENGTH} rotate={pose.backArm}><Arm look={look} shade/></Limb>
    <Limb pivot={HIP} width={36} length={LEG_LENGTH} rotate={pose.backLeg}><Leg look={look} shade/></Limb>
    <Svg style={styles.body} width={FIGURE_WIDTH} height={104} viewBox={`0 0 ${FIGURE_WIDTH} 104`}><Body look={look}/></Svg>
    <Limb pivot={HIP} width={36} length={LEG_LENGTH} rotate={pose.frontLeg}><Leg look={look}/></Limb>
    <Limb pivot={SHOULDER} width={24} length={ARM_LENGTH} rotate={pose.frontArm}>
      <Arm look={look}/>
      {phoneVisible && <Animated.View style={[styles.phone, { opacity: phoneVisible }]}><Phone/></Animated.View>}
    </Limb>
  </Animated.View>;
}

/** A limb hanging from a joint and rotating around it. */
function Limb({ pivot, width, length, rotate, children }: { pivot: { x: number; y: number }; width: number; length: number; rotate: Animated.AnimatedInterpolation<string>; children: React.ReactNode }) {
  return <Animated.View style={{ position: "absolute", left: pivot.x - width / 2, top: pivot.y - 4, width, height: length, transformOrigin: "50% 4px", transform: [{ rotate }] }}>{children}</Animated.View>;
}

function Arm({ look, shade = false }: { look: Look; shade?: boolean }) {
  const shirt = shade ? look.shirtShade : look.shirt;
  const skin = shade ? look.skinShade : look.skin;
  return <Svg width={24} height={ARM_LENGTH} viewBox={`0 0 24 ${ARM_LENGTH}`}>
    <Rect x={8} y={18} width={8} height={30} rx={4} fill={skin}/>
    <Rect x={6.5} y={0} width={11} height={24} rx={5.5} fill={shirt}/>
    <Ellipse cx={12} cy={51} rx={5} ry={5.5} fill={skin}/>
  </Svg>;
}

function Leg({ look, shade = false }: { look: Look; shade?: boolean }) {
  return <Svg width={36} height={LEG_LENGTH} viewBox={`0 0 36 ${LEG_LENGTH}`}>
    <Rect x={12} y={0} width={12} height={62} rx={6} fill={shade ? look.pantsShade : look.pants}/>
    <Path d="M11 60 Q11 56 16 56 L26 57 Q34 58 34 64 L34 66 L11 66 Z" fill={shade ? look.sole : look.shoe}/>
    <Rect x={10} y={65} width={25} height={3.5} rx={1.5} fill={look.sole}/>
  </Svg>;
}

/** Head, neck and torso (and the buyer's bag). */
function Body({ look }: { look: Look }) {
  const buyer = look.kind === "buyer";
  return <>
    {buyer && <Path d="M33 6 C24 6 22 16 24 26 C25 34 22 40 19 44 C26 45 31 40 31 32 Z" fill={look.hair}/>}
    {/* neck and torso */}
    <Rect x={37} y={30} width={9} height={12} rx={3} fill={look.skinShade}/>
    <Rect x={27} y={38} width={28} height={60} rx={12} fill={look.shirt}/>
    <Rect x={27} y={38} width={9} height={60} rx={6} fill={look.shirtShade} opacity={0.55}/>
    <Path d="M36 38 Q41 45 47 38" stroke={look.shirtShade} strokeWidth={2} fill="none"/>
    <Rect x={28} y={88} width={26} height={14} rx={6} fill={look.pants}/>
    {buyer && <>
      <Path d="M45 40 L31 86" stroke="#6E3B28" strokeWidth={2.2}/>
      <Rect x={22} y={80} width={14} height={13} rx={3} fill="#8A4A32"/>
    </>}
    {/* head, side-on */}
    <Ellipse cx={42} cy={20} rx={13} ry={15} fill={look.skin}/>
    <Path d="M53 17 Q57 21 54.5 24.5" fill={look.skin}/>
    <Ellipse cx={37} cy={21} rx={3} ry={4} fill={look.skinShade}/>
    <Circle cx={49} cy={18} r={1.6} fill={colors.charcoal}/>
    <Path d="M46.5 14.5 L51.5 14" stroke={look.hair} strokeWidth={1.4} strokeLinecap="round"/>
    <Path d="M49 29 Q51.5 30 53 28.5" stroke="#7A3F2E" strokeWidth={1.4} fill="none" strokeLinecap="round"/>
    {buyer
      ? <Path d="M29 19 C28 7 36 3 44 4 C51 5 55 9 55 14 C50 11 44 10 39 12 C36 14 34 18 33 23 C31 22 30 21 29 19 Z" fill={look.hair}/>
      : <>
          <Path d="M29 17 C29 7 36 4 43 4 C50 4 55 8 55 13 C49 10 42 10 37 13 C35 15 34 17 33 19 C31 19 30 18 29 17 Z" fill={look.hair}/>
          <Path d="M34 24 Q36 33 44 34 Q51 34 54 27 Q50 31 44 30 Q38 29 36 24 Z" fill={look.hair} opacity={0.35}/>
        </>}
  </>;
}

function Phone() {
  return <Svg width={12} height={19} viewBox="0 0 12 19">
    <Rect x={0} y={0} width={12} height={19} rx={2.5} fill={colors.charcoal}/>
    <Rect x={1.5} y={2} width={9} height={14} rx={1} fill="#BFE3CF"/>
    <Path d="M3.5 9.5 L5.3 11.3 L8.5 6.8" stroke={colors.green} strokeWidth={1.5} fill="none" strokeLinecap="round"/>
  </Svg>;
}

function Parcel() {
  return <Svg width={BOX_WIDTH} height={BOX_HEIGHT} viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}>
    <Rect x={0.5} y={2} width={31} height={24.5} rx={2.5} fill="#D6A06A"/>
    <Path d="M0.5 9 L31.5 9" stroke="#C38A54" strokeWidth={1}/>
    <Rect x={0.5} y={2} width={31} height={7} rx={2.5} fill="#C9935D"/>
    <Rect x={13.5} y={2} width={5} height={24.5} fill="#E9D3B2" opacity={0.85}/>
    <Rect x={20} y={14} width={9} height={7} rx={1} fill="#FFF8EE"/>
    <Path d="M4 21 C6 17 9 17 10 19" stroke={colors.green} strokeWidth={1.5} fill="none" strokeLinecap="round"/>
  </Svg>;
}

const styles = StyleSheet.create({
  // No backdrop: the people walk on the page itself, on a faint ground line.
  stage: { width: "100%", height: STAGE_HEIGHT, overflow: "hidden" },
  ground: { position: "absolute", left: 0, right: 0, top: GROUND - 1, height: 2, borderRadius: 1, backgroundColor: colors.border },
  figure: { position: "absolute", left: 0, top: FIGURE_TOP, width: FIGURE_WIDTH, height: FIGURE_HEIGHT },
  body: { position: "absolute", left: 0, top: 0 },
  phone: { position: "absolute", left: 13, top: ARM_LENGTH - 17 },
  shadow: { position: "absolute", left: SHOULDER.x - 22, top: GROUND - 3, width: 44, height: 8, borderRadius: 4, backgroundColor: "rgba(41,41,41,0.10)" },
  box: { position: "absolute", left: 0, top: 0, width: BOX_WIDTH, height: BOX_HEIGHT },
  paid: { position: "absolute", left: 0, top: FIGURE_TOP - 46, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.green, shadowColor: colors.charcoal, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  paidIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  paidCheck: { color: colors.white, fontWeight: "800", fontSize: 12, lineHeight: 14 },
  paidTitle: { ...typography.caption, color: colors.green, fontWeight: "800", lineHeight: 15 },
  paidSub: { ...typography.label, color: colors.textSecondary, fontSize: 10, lineHeight: 12 },
  done: { position: "absolute", left: 0, top: FIGURE_TOP + 4, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  doneText: { color: colors.white, fontWeight: "800", fontSize: 16, lineHeight: 19 },
});
