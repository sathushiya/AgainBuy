import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { ConfirmDialog, EmptyState, ErrorMessage, LoadingIndicator, PrimaryButton, ScreenContainer } from "../../components/core";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { AssistantConversationSummary } from "../../types";
import { timeAgo } from "../../utils/format";

/** The signed-in user's saved AI conversations, newest first. Tap one to continue it. */
export function AssistantHistoryScreen({ navigation }: { navigation: any }) {
  const { data: conversations, error, loading, setData } = useApiData(() => api.assistantConversations());
  const [deleting, setDeleting] = React.useState<AssistantConversationSummary | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Back to the chat screen underneath, showing the chosen (or a new) conversation.
  const open = (conversationId?: string) => navigation.popTo("Assistant", conversationId ? { conversationId } : {});

  const remove = async (conversation: AssistantConversationSummary) => {
    setDeleting(null);
    setActionError(null);
    try {
      await api.deleteAssistantConversation(conversation.id);
      setData((conversations ?? []).filter((item) => item.id !== conversation.id));
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  return <ScreenContainer>
    <View style={styles.header}>
      <Text style={styles.subtitle}>Your chats with the AgainBuy assistant. Only you can see them.</Text>
      <PrimaryButton title="New chat" icon={<AppIcon name="create-outline" size={18} color={colors.white}/>} onPress={() => open()} style={styles.newChat}/>
    </View>
    {(error || actionError) && <ErrorMessage message={(actionError ?? error)!}/>}
    {loading && !conversations ? <LoadingIndicator/> : (conversations ?? []).length === 0
      ? <EmptyState icon="sparkles-outline" title="No chats yet" message="Ask the assistant anything about AgainBuy and your chat will be saved here."/>
      : (conversations ?? []).map((conversation) => <View key={conversation.id} style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open chat: ${conversation.title}`} onPress={() => open(conversation.id)} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
            <View style={styles.icon}><AppIcon name="sparkles-outline" size={18} color={colors.terracotta}/></View>
            <View style={styles.flex}>
              <View style={styles.titleRow}><Text numberOfLines={1} style={styles.title}>{conversation.title}</Text><Text style={styles.time}>{timeAgo(conversation.updatedAt)}</Text></View>
              {conversation.productTitle && <Text numberOfLines={1} style={styles.product}>About: {conversation.productTitle}</Text>}
              <Text numberOfLines={2} style={styles.preview}>{conversation.lastMessage}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete chat: ${conversation.title}`} hitSlop={8} onPress={() => setDeleting(conversation)} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
            <AppIcon name="trash-outline" size={18} color={colors.textSecondary}/>
          </Pressable>
        </View>)}
    <ConfirmDialog visible={!!deleting} destructive title="Delete this chat?" message={deleting ? `"${deleting.title}" and all its messages will be deleted. This can't be undone.` : ""} confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)}/>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary },
  newChat: { alignSelf: "flex-start", minHeight: 42 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, paddingRight: spacing.xs },
  main: { flex: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  pressed: { opacity: 0.82 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs },
  title: { ...typography.caption, color: colors.charcoal, fontWeight: "700", flex: 1 },
  time: { ...typography.label, color: colors.textSecondary },
  product: { ...typography.label, color: colors.terracotta, marginTop: 2 },
  preview: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  delete: { padding: spacing.xs },
});
