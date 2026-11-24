import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { EmptyState, ErrorMessage, LoadingIndicator, ScreenContainer } from "../../components/core";
import { useApp } from "../../context/AppContext";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { AppNotification, NotificationType } from "../../types";
import { messageTime } from "../../utils/format";

const ICONS: Record<NotificationType, AppIconName> = {
  Reserved: "bag-check-outline",
  ReservationCancelled: "information-circle-outline",
  PriceChanged: "pricetag-outline",
  DealAgreed: "checkmark-circle-outline",
  PaymentSubmitted: "receipt-outline",
  PaymentConfirmed: "checkmark-circle-outline",
  PaymentRejected: "alert-circle-outline",
  Shipped: "cube-outline",
  ReadyForPickup: "location-outline",
  ReceiptGenerated: "receipt-outline",
  Delivered: "checkmark-circle-outline",
  Completed: "leaf-outline",
};

/** Order updates for the signed-in user; tapping one opens its order. */
export function NotificationsScreen({ navigation }: { navigation: any }) {
  const { refreshNotifications } = useApp();
  const { data: notifications, error, loading, setData } = useApiData(() => api.notifications());
  const [actionError, setActionError] = React.useState<string | null>(null);
  const unread = (notifications ?? []).filter((notification) => !notification.read).length;

  // Keep the Profile badge in step with this list.
  React.useEffect(() => { if (notifications) refreshNotifications(); }, [notifications, refreshNotifications]);

  const open = async (notification: AppNotification) => {
    setActionError(null);
    try {
      if (!notification.read) {
        await api.markNotificationRead(notification.id);
        setData((notifications ?? []).map((item) => item.id === notification.id ? { ...item, read: true } : item));
      }
      if (notification.orderId) navigation.navigate("OrderDetail", { id: notification.orderId });
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };
  const markAllRead = async () => {
    setActionError(null);
    try {
      await api.markAllNotificationsRead();
      setData((notifications ?? []).map((item) => ({ ...item, read: true })));
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return <ScreenContainer>
    <View style={styles.header}><Text style={styles.subtitle}>{unread ? `${unread} unread` : "You're all caught up"}</Text>{unread > 0 && <Pressable accessibilityRole="button" onPress={markAllRead}><Text style={styles.markAll}>Mark all read</Text></Pressable>}</View>
    {(error || actionError) && <ErrorMessage message={(actionError ?? error)!}/>}
    {loading && !notifications ? <LoadingIndicator/> : (notifications ?? []).length === 0
      ? <EmptyState icon="notifications-outline" title="No notifications yet" message="Updates about your reservations, payments and deliveries appear here."/>
      : (notifications ?? []).map((notification) => <Pressable key={notification.id} accessibilityRole="button" accessibilityLabel={`${notification.read ? "" : "Unread: "}${notification.title}`} onPress={() => open(notification)} style={({ pressed }) => [styles.item, !notification.read && styles.unread, pressed && styles.pressed]}>
          <View style={styles.icon}><AppIcon name={ICONS[notification.type] ?? "notifications-outline"} size={20} color={colors.terracotta}/></View>
          <View style={styles.copy}>
            <View style={styles.row}><Text style={[styles.title, !notification.read && styles.titleUnread]}>{notification.title}</Text><Text style={styles.time}>{messageTime(notification.createdAt)}</Text></View>
            <Text style={styles.body}>{notification.body}</Text>
          </View>
          {!notification.read && <View style={styles.dot}/>}
        </Pressable>)}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary },
  markAll: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
  item: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.sm },
  unread: { borderColor: colors.terracotta },
  pressed: { opacity: 0.82 },
  icon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs },
  title: { ...typography.caption, color: colors.charcoal, flex: 1 },
  titleUnread: { fontWeight: "700" },
  time: { ...typography.label, color: colors.textSecondary },
  body: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.terracotta, alignSelf: "center" },
});
