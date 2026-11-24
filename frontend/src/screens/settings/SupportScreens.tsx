import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { AppTextInput, ErrorMessage, PrimaryButton, ScreenContainer } from "../../components/core";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";
import { SupportTicketType } from "../../types";
import { formatDate } from "../../utils/format";

interface GuideSection {
  icon: AppIconName;
  title: string;
  points: string[];
}

function Guide({ intro, sections }: { intro: string; sections: GuideSection[] }) {
  return <ScreenContainer><Text style={styles.intro}>{intro}</Text>{sections.map((section) => <View key={section.title} style={styles.section}><View style={styles.sectionHeader}><View style={styles.icon}><AppIcon name={section.icon} size={20} color={colors.terracotta}/></View><Text style={styles.sectionTitle}>{section.title}</Text></View>{section.points.map((point) => <View key={point} style={styles.point}><View style={styles.bullet}/><Text style={styles.pointText}>{point}</Text></View>)}</View>)}</ScreenContainer>;
}

export function BuyingSafelyScreen() {
  return <Guide intro="Most AgainBuy trades go smoothly. These habits keep it that way." sections={[
    { icon: "chatbubble-outline", title: "Before you meet", points: [
      "Read the whole listing, including known defects and what accessories are included.",
      "Ask the seller about anything unclear, and keep the conversation in AgainBuy messages.",
      "Check the seller's rating and how long the listing has been up.",
    ] },
    { icon: "shield-checkmark-outline", title: "Meeting up", points: [
      "Meet somewhere busy and public, in daylight. Bring a friend if you can.",
      "Inspect and test the item at pickup: switch it on, check the screen, battery and buttons. Ask for extra photos or a video call in chat before you pay.",
      "For phones and laptops, check the serial or IMEI number matches the box or receipt.",
    ] },
    { icon: "information-circle-outline", title: "Paying", points: [
      "Tap Reserve to hold the item. It leaves browsing while you and the seller agree the price in chat, then you both confirm the deal.",
      "Pay by bank transfer only to the account shown on the order after the deal is agreed, then upload your receipt. The seller confirms the payment; it is never confirmed automatically.",
      "AgainBuy never moves money and will never ask for your card details or password.",
      "For pickup, inspect the item before you confirm it was handed over. For delivery, track it with the courier and confirm only when it arrives.",
    ] },
    { icon: "alert-circle-outline", title: "If something feels wrong", points: [
      "Walk away. A genuine seller will understand.",
      "Report the listing from its page, or use Report a problem in Settings & Help.",
    ] },
  ]}/>;
}

export function SellingGuidelinesScreen() {
  return <Guide intro="Honest, complete listings sell faster and get fewer questions." sections={[
    { icon: "camera-outline", title: "Describe it honestly", points: [
      "Add clear photos of the front, back, labels and any damage.",
      "State the real condition, how long you used it, and every known defect.",
      "List what's included and what's missing, such as chargers, boxes or manuals.",
    ] },
    { icon: "pricetag-outline", title: "Price it fairly", points: [
      "Add the original price so buyers can see the saving.",
      "Look at similar listings before choosing a price.",
    ] },
    { icon: "alert-circle-outline", title: "Items you can't sell", points: [
      "Counterfeit or replica goods, and anything stolen.",
      "Prescription medicines, weapons, and hazardous or illegal items.",
      "Listings that break these rules are removed, and repeated breaches can close your account.",
    ] },
    { icon: "shield-checkmark-outline", title: "Handing it over", points: [
      "Add your bank transfer details in Settings & Help before agreeing a deal; buyers see them once you both agree.",
      "Check the money has reached your account before you confirm the payment. Never ship or hand over before that.",
      "For delivery, book PickMe or Domex yourself and enter the tracking number. For pickup, meet in a public place and mark the order ready for pickup.",
      "The buyer confirms delivery, which completes the sale. Deactivate listings you sell elsewhere.",
    ] },
  ]}/>;
}

export function ReportProblemScreen() {
  return <SupportForm type="problem" intro="Something not working, or a listing or user that worries you? Tell us what happened." subjectHint="e.g. Photos won't upload" messageHint="What happened, and which listing or person is it about?"/>;
}

export function ContactSupportScreen() {
  return <SupportForm type="contact" intro="Questions about your account, a trade or how AgainBuy works? Send us a message." subjectHint="e.g. Question about my sale" messageHint="How can we help?"/>;
}

function SupportForm({ type, intro, subjectHint, messageHint }: { type: SupportTicketType; intro: string; subjectHint: string; messageHint: string }) {
  const { data: tickets = [], reload } = useApiData(() => api.supportTickets());
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  const subjectError = subject && subject.trim().length < 3 ? "Add a short subject." : undefined;
  const messageError = message && message.trim().length < 10 ? "Describe it in at least 10 characters." : undefined;
  const ready = subject.trim().length >= 3 && message.trim().length >= 10;

  const send = async () => {
    setSending(true);
    setNotice(null);
    try {
      const ticket = await api.createSupportTicket({ type, subject: subject.trim(), message: message.trim() });
      setSubject(""); setMessage("");
      setNotice({ ok: true, text: `Sent. Your reference is .` });
      void reload();
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    } finally {
      setSending(false);
    }
  };

  const recent = tickets.filter((ticket) => ticket.type === type).slice(0, 5);
  return <ScreenContainer keyboardAware><Text style={styles.intro}>{intro}</Text><View style={styles.form}><AppTextInput label="Subject" value={subject} onChangeText={setSubject} placeholder={subjectHint} error={subjectError}/><AppTextInput label="Details" value={message} onChangeText={setMessage} placeholder={messageHint} multiline error={messageError}/>{notice && (notice.ok ? <Text style={styles.success}>{notice.text}</Text> : <ErrorMessage message={notice.text}/>)}<PrimaryButton title="Send" disabled={!ready} loading={sending} onPress={send}/></View>{recent.length > 0 && <View style={styles.recent}><Text style={styles.sectionTitle}>Your recent requests</Text>{recent.map((ticket) => <View key={ticket.id} style={styles.ticket}><View style={styles.flex}><Text style={styles.ticketSubject}>{ticket.subject}</Text><Text style={styles.ticketMeta}>{ticket.id} · {formatDate(ticket.createdAt)}</Text></View><Text style={styles.ticketStatus}>{ticket.status}</Text></View>)}</View>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  section: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  icon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.creamSecondary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { ...typography.title, color: colors.charcoal, flex: 1 },
  point: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.terracotta, marginTop: 8 },
  pointText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  flex: { flex: 1 },
  form: { gap: spacing.md },
  success: { ...typography.caption, color: colors.green, fontWeight: "700" },
  recent: { marginTop: spacing.xl, gap: spacing.sm },
  ticket: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm },
  ticketSubject: { ...typography.medium, color: colors.charcoal },
  ticketMeta: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  ticketStatus: { ...typography.label, color: colors.green },
});
