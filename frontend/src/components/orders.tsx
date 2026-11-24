import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";
import type { OrderDetail } from "../types";
import { formatDate, messageTime } from "../utils/format";
import { ORDER_STEPS, stepTimes } from "../utils/orders";
import { AppIcon } from "./AppIcon";

/** Step-by-step progress for an order, with when each step happened. */
export function OrderTimeline({ order }: { order: OrderDetail }) {
  const steps = ORDER_STEPS[order.summary.deliveryMethod];
  const times = stepTimes(order);

  if (order.summary.status === "Cancelled") {
    return <View style={styles.cancelled}><AppIcon name="close" size={18} color={colors.error}/><Text style={styles.cancelledText}>Reservation removed{order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ""}. The item went back on the marketplace.</Text></View>;
  }

  const current = steps.indexOf(order.summary.status);
  return <View accessibilityRole="list" style={styles.timeline}>{steps.map((step, index) => {
    const done = index < current || order.summary.status === "Completed";
    const active = index === current && order.summary.status !== "Completed";
    const at = index <= current ? times[step] : undefined;
    return <View key={step} accessibilityLabel={`${step}${done ? ", done" : active ? ", current step" : ""}`} style={styles.step}>
      <View style={styles.rail}>
        <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>{done && <AppIcon name="checkmark-circle" size={14} color={colors.white}/>}</View>
        {index < steps.length - 1 && <View style={[styles.line, done && styles.lineDone]}/>}
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepLabel, !done && !active && styles.stepFuture, active && styles.stepActive]}>{step}</Text>
        {at && <Text style={styles.stepTime}>{formatDate(at)} · {messageTime(at)}</Text>}
      </View>
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  timeline: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  step: { flexDirection: "row", gap: spacing.sm, minHeight: 46 },
  rail: { alignItems: "center", width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.green, borderColor: colors.green },
  dotActive: { borderColor: colors.terracotta, backgroundColor: colors.terracottaSoft },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  lineDone: { backgroundColor: colors.green },
  stepCopy: { flex: 1, paddingBottom: spacing.sm },
  stepLabel: { ...typography.medium, color: colors.charcoal },
  stepActive: { color: colors.terracotta },
  stepFuture: { color: colors.textSecondary, fontWeight: "400" },
  stepTime: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  cancelled: { flexDirection: "row", gap: spacing.xs, alignItems: "center", backgroundColor: colors.creamSecondary, borderRadius: radius.md, padding: spacing.md },
  cancelledText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
