import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { AppIcon, AppIconName } from "../components/AppIcon";
import { useApp } from "../context/AppContext";
import { ExploreScreen } from "../screens/explore/ExploreScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { OrderDetailScreen } from "../screens/orders/OrderDetailScreen";
import { OrdersScreen } from "../screens/orders/OrdersScreen";
import { BankDetailsScreen, NotificationPreferencesScreen, PersonalInfoScreen, PrivacySafetyScreen, SavedLocationsScreen } from "../screens/settings/AccountScreens";
import { BuyingSafelyScreen, ContactSupportScreen, ReportProblemScreen, SellingGuidelinesScreen } from "../screens/settings/SupportScreens";
import { ConversationScreen, MessagesScreen } from "../screens/messages/MessagesScreens";
import { ProductDetailScreen } from "../screens/product/ProductDetailScreen";
import { MyListingsScreen, SettingsScreen, WishlistScreen } from "../screens/profile/ProfileScreens";
import { SellScreen } from "../screens/sell/SellScreen";
import { RoleProfileScreen, RoleSettingsScreen } from "../screens/shared/RoleProfileScreen";
import { PurchasesScreen, SalesScreen } from "../screens/transactions/TransactionScreens";
import { colors, radius, typography } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const icons: Record<string, AppIconName> = {
  Home: "home-outline",
  Explore: "search-outline",
  Sell: "add",
  Messages: "chatbubbles-outline",
  Profile: "person-outline",
};

function CustomerTabs() {
  const { unreadMessages, messageAlerts } = useApp();
  return <Tab.Navigator screenOptions={({ route }) => {
    const iconName = icons[route.name] ?? "grid-outline";
    return {
      headerShown: false,
      tabBarActiveTintColor: colors.terracotta,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarLabelStyle: { ...typography.label, fontSize: 10 },
      tabBarStyle: { height: 74, paddingTop: 7, paddingBottom: 10, borderTopColor: colors.border, backgroundColor: colors.white },
      tabBarIcon: ({ color, size, focused }) => route.name === "Sell" ? <View style={styles.sellIcon}><AppIcon name="add" size={27} color={colors.white}/></View> : <AppIcon name={focused ? iconName.replace("-outline", "") : iconName} size={size} color={color}/>,
    };
  }}><Tab.Screen name="Home" component={HomeScreen}/><Tab.Screen name="Explore" component={ExploreScreen}/><Tab.Screen name="Sell" component={SellScreen}/><Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarBadge: messageAlerts && unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined, tabBarBadgeStyle: { backgroundColor: colors.terracotta, color: colors.white, fontSize: 10 } }}/><Tab.Screen name="Profile" component={RoleProfileScreen}/></Tab.Navigator>;
}

export function CustomerNavigator() {
  const { user } = useApp();
  if (user?.role !== "customer") return null;
  return <Stack.Navigator screenOptions={{ headerTintColor: colors.charcoal, headerShadowVisible: false, headerStyle: { backgroundColor: colors.cream }, contentStyle: { backgroundColor: colors.cream } }}><Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }}/><Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }}/><Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: "Conversation" }}/><Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order details" }}/><Stack.Screen name="Orders" component={OrdersScreen} options={({ route }: { route: any }) => ({ title: route.params?.role === "seller" ? "Reserved by customers" : "My orders" })}/><Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }}/><Stack.Screen name="MyListings" component={MyListingsScreen} options={{ title: "My Listings" }}/><Stack.Screen name="Purchases" component={PurchasesScreen} options={{ title: "My Purchases" }}/><Stack.Screen name="Sales" component={SalesScreen} options={{ title: "My Sales" }}/><Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings & Help" }}/><Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} options={{ title: "Personal information" }}/><Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: "Notification preferences" }}/><Stack.Screen name="PrivacySafety" component={PrivacySafetyScreen} options={{ title: "Privacy and safety" }}/><Stack.Screen name="SavedLocations" component={SavedLocationsScreen} options={{ title: "Saved locations" }}/><Stack.Screen name="BankDetails" component={BankDetailsScreen} options={{ title: "Bank transfer details" }}/><Stack.Screen name="BuyingSafely" component={BuyingSafelyScreen} options={{ title: "Buying safely" }}/><Stack.Screen name="SellingGuidelines" component={SellingGuidelinesScreen} options={{ title: "Selling guidelines" }}/><Stack.Screen name="ReportProblem" component={ReportProblemScreen} options={{ title: "Report a problem" }}/><Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ title: "Contact support" }}/><Stack.Screen name="RoleSettings" component={RoleSettingsScreen} options={{ title: "Settings & Support" }}/></Stack.Navigator>;
}

const styles = StyleSheet.create({
  sellIcon: { width: 48, height: 48, marginTop: -22, borderRadius: radius.md, backgroundColor: colors.terracotta, borderWidth: 4, borderColor: colors.white, alignItems: "center", justifyContent: "center" },
});
