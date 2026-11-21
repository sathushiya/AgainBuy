import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { z } from "zod";
import { AgainBuyLogo } from "../../components/AgainBuyLogo";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, ErrorMessage, PrimaryButton, ScreenContainer, SecondaryButton } from "../../components/core";
import { DemoAccountCard } from "../../components/roles";
import { useApp } from "../../context/AppContext";
import { demoUsers } from "../../data/demoUsers";
import { api, errorMessage } from "../../services/api";
import { colors, radius, spacing, typography } from "../../theme";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 1400);
    return () => clearTimeout(timer);
  }, [onFinish]);
  return <View style={styles.splash}><View style={styles.splashMark}><AgainBuyLogo iconOnly width={138}/></View><AgainBuyLogo width={250}/><Text style={styles.splashMessage}>Give Good Things a Second Life.</Text><View style={styles.splashFooter}><View style={styles.sproutLine}/><Text style={styles.splashNote}>A warmer way to buy and sell pre-loved things</Text></View></View>;
}

const slides = [
  { title: "Great finds, fair prices.", body: "Discover quality pre-owned products from people around Sri Lanka.", icon: "search-outline" as const },
  { title: "Sell what you no longer use.", body: "Create a clear, trustworthy listing in a few simple steps.", icon: "camera-outline" as const },
  { title: "Give good things new life.", body: "Every second-hand purchase keeps useful products in circulation.", icon: "leaf-outline" as const },
];

export function OnboardingScreen({ navigation, onComplete }: { navigation: any; onComplete?: () => void }) {
  const [index, setIndex] = React.useState(0);
  const slide = slides[index]!;
  const finish = () => onComplete ? onComplete() : navigation.replace("Login");
  return <ScreenContainer contentStyle={styles.onboarding}><View style={styles.onboardingTop}><AgainBuyLogo width={156}/><Pressable accessibilityRole="button" onPress={finish}><Text style={styles.skip}>Skip</Text></Pressable></View><View style={styles.illustration}><View style={styles.illustrationCircle}><AppIcon name={slide.icon} size={64} color={index === 2 ? colors.green : colors.terracotta}/></View><View style={[styles.smallOrb, styles.orbOne]}/><View style={[styles.smallOrb, styles.orbTwo]}/></View><Text style={styles.onboardingTitle}>{slide.title}</Text><Text style={styles.onboardingBody}>{slide.body}</Text><View style={styles.dots}>{slides.map((_, dot) => <View key={dot} style={[styles.dot, dot === index && styles.dotActive]}/>)}</View><View style={styles.onboardingActions}>{index > 0 && <SecondaryButton title="Back" onPress={() => setIndex((value) => value - 1)} style={styles.action}/>}<PrimaryButton title={index === slides.length - 1 ? "Get started" : "Continue"} onPress={() => index === slides.length - 1 ? finish() : setIndex((value) => value + 1)} style={styles.action}/></View></ScreenContainer>;
}

const loginSchema = z.object({ email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.") });

export function LoginScreen({ navigation }: { navigation: any }) {
  const { signIn, isAuthenticating, authError, clearAuthError } = useApp();
  const [remember, setRemember] = React.useState(false);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [showDemos, setShowDemos] = React.useState(false);
  const { control, handleSubmit, setValue, formState: { errors, isValid } } = useForm({ resolver: zodResolver(loginSchema), mode: "onChange", defaultValues: { email: "", password: "" } });
  const submit = handleSubmit(async (values) => {
    clearAuthError();
    await signIn(values.email, values.password);
  });
  const fillAccount = (email: string, password: string) => {
    clearAuthError();
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };
  return <ScreenContainer keyboardAware contentStyle={styles.authContent}><AgainBuyLogo width={210}/><Text style={styles.authTitle}>Welcome back</Text><Text style={styles.authBody}>One secure entry point for customers, facility teams, and platform administrators.</Text><View style={styles.form}><Controller control={control} name="email" render={({ field }) => <AppTextInput label="Email address" keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" value={field.value} onChangeText={(value) => { clearAuthError(); field.onChange(value); }} error={errors.email?.message}/>}/><Controller control={control} name="password" render={({ field }) => <AppTextInput label="Password" secureTextEntry={!passwordVisible} placeholder="Your password" value={field.value} onChangeText={(value) => { clearAuthError(); field.onChange(value); }} error={errors.password?.message} rightElement={<Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} hitSlop={8} onPress={() => setPasswordVisible((value) => !value)}><AppIcon name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={21} color={colors.textSecondary}/></Pressable>}/>}/><View style={styles.loginOptions}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember((value) => !value)} style={styles.remember}><View style={[styles.checkbox, remember && styles.checkboxChecked]}>{remember && <AppIcon name="checkmark-circle" size={15} color={colors.white}/>}</View><Text style={styles.optionText}>Remember me</Text></Pressable><Pressable accessibilityRole="button" onPress={() => navigation.navigate("ForgotPassword")}><Text style={styles.forgot}>Forgot password?</Text></Pressable></View>{authError && <ErrorMessage message={authError}/>}<PrimaryButton title="Sign in" onPress={submit} disabled={!isValid} loading={isAuthenticating}/><SecondaryButton title="Create a customer account" onPress={() => navigation.navigate("Register")}/><Text style={styles.demo}>Signs in through the AgainBuy API. The demo accounts below are seeded in development.</Text></View><Pressable accessibilityRole="button" accessibilityState={{ expanded: showDemos }} onPress={() => setShowDemos((value) => !value)} style={styles.demoToggle}><View><Text style={styles.demoTitle}>Demo Accounts</Text><Text style={styles.demoSubtitle}>Development credentials for all three roles</Text></View><AppIcon name={showDemos ? "chevron-up" : "chevron-down"} size={20} color={colors.terracotta}/></Pressable>{showDemos && <View style={styles.demoList}>{demoUsers.map((account) => <DemoAccountCard key={account.id} account={account} loading={isAuthenticating} onUse={() => fillAccount(account.email, account.password)} onQuickLogin={() => { fillAccount(account.email, account.password); void signIn(account.email, account.password); }}/>)}</View>}</ScreenContainer>;
}

const registrationSchema = z.object({ name: z.string().min(2, "Enter your full name."), email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.") });

export function RegisterScreen() {
  const { register } = useApp();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { control, handleSubmit, formState: { errors, isValid } } = useForm({ resolver: zodResolver(registrationSchema), mode: "onChange", defaultValues: { name: "", email: "", password: "" } });
  return <ScreenContainer keyboardAware><AgainBuyLogo width={170}/><Text style={styles.authTitle}>One account. Buy and sell.</Text><Text style={styles.authBody}>Create your AgainBuy profile to shop, list items, and message sellers.</Text><View style={styles.form}><Controller control={control} name="name" render={({ field }) => <AppTextInput label="Full name" value={field.value} onChangeText={field.onChange} error={errors.name?.message}/>}/><Controller control={control} name="email" render={({ field }) => <AppTextInput label="Email address" keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} error={errors.email?.message}/>}/><Controller control={control} name="password" render={({ field }) => <AppTextInput label="Password" secureTextEntry value={field.value} onChangeText={field.onChange} error={errors.password?.message}/>}/><PrimaryButton title="Create my account" disabled={!isValid} loading={loading} onPress={handleSubmit(async (values) => { setLoading(true); setError(await register(values.name, values.email, values.password)); setLoading(false); })}/>{error && <ErrorMessage message={error}/>}</View></ScreenContainer>;
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const valid = /^S+@S+.S+$/.test(email.trim());
  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };
  return <ScreenContainer><AgainBuyLogo width={170}/><Text style={styles.authTitle}>Reset your password</Text><Text style={styles.authBody}>Enter your email and we’ll send you a secure reset link.</Text><View style={styles.form}><AppTextInput label="Email address" keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" value={email} onChangeText={setEmail}/>{error && <ErrorMessage message={error}/>}{sent ? <View style={styles.success}><AppIcon name="checkmark-circle-outline" size={21} color={colors.green}/><Text style={styles.successText}>If an account exists for this email, reset instructions are on their way.</Text></View> : <PrimaryButton title="Send reset link" disabled={!valid} loading={loading} onPress={submit}/>}</View></ScreenContainer>;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  splashMark: { width: 170, height: 170, borderRadius: 60, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  splashMessage: { ...typography.title, color: colors.green, marginTop: spacing.md, textAlign: "center" },
  splashFooter: { position: "absolute", bottom: 55, alignItems: "center", gap: spacing.xs },
  sproutLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: colors.green },
  splashNote: { ...typography.caption, color: colors.textSecondary },
  onboarding: { flexGrow: 1 },
  onboardingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
  illustration: { flex: 1, minHeight: 340, alignItems: "center", justifyContent: "center" },
  illustrationCircle: { width: 220, height: 220, borderRadius: 76, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  smallOrb: { position: "absolute", width: 40, height: 40, borderRadius: 14, backgroundColor: colors.terracottaSoft },
  orbOne: { top: "25%", left: "12%" },
  orbTwo: { bottom: "22%", right: "10%", backgroundColor: colors.greenSoft },
  onboardingTitle: { ...typography.display, color: colors.charcoal, textAlign: "center" },
  onboardingBody: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, paddingHorizontal: spacing.md },
  dots: { flexDirection: "row", justifyContent: "center", gap: 7, marginVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.terracotta },
  onboardingActions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
  authContent: { paddingTop: spacing.lg },
  authTitle: { ...typography.display, color: colors.charcoal, marginTop: spacing.lg },
  authBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.md, marginTop: spacing.lg },
  loginOptions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remember: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  optionText: { ...typography.caption, color: colors.textSecondary },
  forgot: { ...typography.caption, color: colors.terracotta, fontWeight: "700", textAlign: "right" },
  demo: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
  demoToggle: { minHeight: 70, marginTop: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  demoTitle: { ...typography.medium, color: colors.charcoal },
  demoSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  demoList: { gap: spacing.sm, marginTop: spacing.sm },
  success: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  successText: { ...typography.caption, color: colors.green },
});
