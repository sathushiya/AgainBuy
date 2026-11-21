import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useApp } from "../context/AppContext";
import { ForgotPasswordScreen, LoginScreen, OnboardingScreen, RegisterScreen, SplashScreen } from "../screens/auth/AuthScreens";
import { colors } from "../theme";
import { AdminNavigator } from "./AdminNavigator";
import { CustomerNavigator } from "./CustomerNavigator";

const Stack = createNativeStackNavigator();

function AuthNavigator({ seenOnboarding, onSeen }: { seenOnboarding: boolean; onSeen: () => void }) {
  return <Stack.Navigator initialRouteName={seenOnboarding ? "Login" : "Onboarding"} screenOptions={{ headerTintColor: colors.charcoal, headerShadowVisible: false, headerStyle: { backgroundColor: colors.cream }, contentStyle: { backgroundColor: colors.cream } }}><Stack.Screen name="Onboarding" options={{ headerShown: false }}>{(props) => <OnboardingScreen {...props} onComplete={() => { onSeen(); props.navigation.replace("Login"); }}/>}</Stack.Screen><Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/><Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create account" }}/><Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Password recovery" }}/></Stack.Navigator>;
}

export function AppNavigator() {
  const { user } = useApp();
  const [splash, setSplash] = React.useState(true);
  const [seenOnboarding, setSeenOnboarding] = React.useState(false);
  const finishSplash = React.useCallback(() => setSplash(false), []);
  if (splash) return <SplashScreen onFinish={finishSplash}/>;
  if (!user) return <AuthNavigator seenOnboarding={seenOnboarding} onSeen={() => setSeenOnboarding(true)}/>;
  if (user.role === "customer") return <CustomerNavigator/>;
  if (user.role === "admin") return <AdminNavigator/>;
  return <AuthNavigator seenOnboarding onSeen={() => setSeenOnboarding(true)}/>;
}
