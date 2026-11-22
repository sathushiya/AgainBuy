import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, ErrorMessage, PrimaryButton, ScreenContainer, SecondaryButton } from "../../components/core";
import { useApp } from "../../context/AppContext";
import { api, errorMessage } from "../../services/api";
import { pickPhotos, uploadPhoto } from "../../services/photos";
import { colors, radius, spacing, typography } from "../../theme";

export function PersonalInfoScreen() {
  const { user, updateUser } = useApp();
  const [name, setName] = React.useState(user?.name ?? "");
  const [location, setLocation] = React.useState(user?.location ?? "");
  const [avatar, setAvatar] = React.useState(user?.avatar ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);
  if (!user) return null;

  const nameError = name.trim().length < 2 ? "Enter your full name." : undefined;
  const changed = name.trim() !== user.name || location.trim() !== user.location || avatar !== user.avatar;

  const changePhoto = async () => {
    setNotice(null);
    try {
      const [asset] = await pickPhotos(1);
      if (!asset) return;
      setUploading(true);
      setAvatar(await uploadPhoto(asset));
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      updateUser(await api.updateProfile({ name: name.trim(), location: location.trim(), avatar: avatar || undefined }));
      setNotice({ ok: true, text: "Your profile has been updated." });
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  };

  return <ScreenContainer keyboardAware><View style={styles.photoRow}>{avatar ? <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel="Your profile photo"/> : <View style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{user.name.slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.flex}><Text style={styles.label}>Profile photo</Text><Text style={styles.hint}>Buyers and sellers see this next to your listings and messages.</Text><SecondaryButton title={uploading ? "Uploading…" : "Change photo"} icon={<AppIcon name="camera-outline" size={18} color={colors.charcoal}/>} onPress={uploading ? () => {} : changePhoto} style={styles.photoButton}/></View></View><View style={styles.form}><AppTextInput label="Full name" value={name} onChangeText={setName} error={nameError}/><AppTextInput label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Colombo 05"/><View><Text style={styles.label}>Email address</Text><Text style={styles.readOnly}>{user.email}</Text><Text style={styles.hint}>Your email is used to sign in and can't be changed here.</Text></View>{notice && (notice.ok ? <Text style={styles.success}>{notice.text}</Text> : <ErrorMessage message={notice.text}/>)}<PrimaryButton title="Save changes" disabled={!changed || !!nameError || uploading} loading={saving} onPress={save}/></View></ScreenContainer>;
}

export function PrivacySafetyScreen() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  const nextError = next && next.length < 8 ? "Use at least 8 characters." : next && next === current ? "Choose a password you haven't used here." : undefined;
  const confirmError = confirm && confirm !== next ? "Passwords don't match." : undefined;
  const ready = current.length > 0 && next.length >= 8 && confirm === next && !nextError;

  const changePassword = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await api.changePassword(current, next);
      setCurrent(""); setNext(""); setConfirm("");
      setNotice({ ok: true, text: "Password changed. Use your new password next time you sign in." });
    } catch (caught) {
      setNotice({ ok: false, text: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  };

  return <ScreenContainer keyboardAware><Text style={styles.sectionTitle}>Change password</Text><View style={styles.form}><AppTextInput label="Current password" secureTextEntry value={current} onChangeText={setCurrent}/><AppTextInput label="New password" secureTextEntry value={next} onChangeText={setNext} error={nextError}/><AppTextInput label="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} error={confirmError}/>{notice && (notice.ok ? <Text style={styles.success}>{notice.text}</Text> : <ErrorMessage message={notice.text}/>)}<PrimaryButton title="Change password" disabled={!ready} loading={saving} onPress={changePassword}/></View><Text style={[styles.sectionTitle, styles.spaced]}>What other people see</Text><InfoCard icon="person-outline" title="Visible on your listings and messages" text="Your name, profile photo, rating and the pickup location you choose for each listing."/><InfoCard icon="shield-checkmark-outline" title="Never shown to other users" text="Your email address, your password and your saved locations. AgainBuy staff will never ask for your password."/><InfoCard icon="alert-circle-outline" title="Stay safe" text="Keep conversations in AgainBuy messages, never share bank details, and report anything suspicious from Settings & Help."/></ScreenContainer>;
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <View style={styles.infoCard}><AppIcon name={icon} size={22} color={colors.green}/><View style={styles.flex}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.hint}>{text}</Text></View></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  avatar: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.creamSecondary },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { ...typography.heading, color: colors.terracotta },
  photoButton: { alignSelf: "flex-start", minHeight: 40, marginTop: spacing.xs },
  form: { gap: spacing.md, marginTop: spacing.lg },
  label: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  hint: { ...typography.label, color: colors.textSecondary, marginTop: 2 },
  readOnly: { ...typography.body, color: colors.charcoal, marginTop: spacing.xs },
  success: { ...typography.caption, color: colors.green, fontWeight: "700" },
  sectionTitle: { ...typography.title, color: colors.charcoal },
  spaced: { marginTop: spacing.xl, marginBottom: spacing.sm },
  infoCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  infoTitle: { ...typography.medium, color: colors.charcoal },
});
