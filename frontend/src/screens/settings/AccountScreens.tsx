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
});
