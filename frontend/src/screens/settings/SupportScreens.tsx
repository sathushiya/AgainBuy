import { StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName } from "../../components/AppIcon";
import { ScreenContainer } from "../../components/core";
import { colors, radius, spacing, typography } from "../../theme";

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
      "Inspect and test the item before paying: switch it on, check the screen, battery and buttons.",
      "For phones and laptops, check the serial or IMEI number matches the box or receipt.",
    ] },
    { icon: "information-circle-outline", title: "Paying", points: [
      "Never send a deposit or pay in advance. Pay only after you have inspected the item.",
      "AgainBuy never handles payments and will never ask you for card or bank details.",
      "Use Buy now to reserve the item, then mark the purchase completed after the handover.",
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
      "Meet in a public place and let the buyer inspect the item.",
      "Don't hand the item over until you have been paid.",
      "Mark the sale completed afterwards, and deactivate listings you sell elsewhere.",
    ] },
  ]}/>;
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
});
