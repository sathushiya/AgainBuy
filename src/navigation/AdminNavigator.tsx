import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppIcon, AppIconName } from "../components/AppIcon";
import { useApp } from "../context/AppContext";
import { AdminDashboard, FacilityAdministrationScreen, ListingModerationScreen, UserManagementScreen } from "../screens/admin/AdminScreens";
import { RoleProfileScreen, RoleSettingsScreen } from "../screens/shared/RoleProfileScreen";
import { colors, typography } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const icons: Record<string, AppIconName> = { Overview: "home-outline", Users: "users-outline", Facilities: "business-outline", Moderation: "file-warning-outline", Profile: "person-outline" };

function AdminTabs() {
  return <Tab.Navigator screenOptions={({ route }) => {
    const iconName = icons[route.name] ?? "grid-outline";
    return {
      headerShown: false,
      tabBarActiveTintColor: colors.terracotta,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarLabelStyle: { ...typography.label, fontSize: 9 },
      tabBarStyle: { height: 74, paddingTop: 7, paddingBottom: 10, borderTopColor: colors.border, backgroundColor: colors.white },
      tabBarIcon: ({ color, size }) => <AppIcon name={iconName} size={size} color={color}/>,
    };
  }}><Tab.Screen name="Overview" component={AdminDashboard}/><Tab.Screen name="Users" component={UserManagementScreen}/><Tab.Screen name="Facilities" component={FacilityAdministrationScreen}/><Tab.Screen name="Moderation" component={ListingModerationScreen}/><Tab.Screen name="Profile" component={RoleProfileScreen}/></Tab.Navigator>;
}

export function AdminNavigator() {
  const { user } = useApp();
  if (user?.role !== "admin") return null;
  return <Stack.Navigator screenOptions={{ headerTintColor: colors.charcoal, headerShadowVisible: false, headerStyle: { backgroundColor: colors.cream }, contentStyle: { backgroundColor: colors.cream } }}><Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }}/><Stack.Screen name="RoleSettings" component={RoleSettingsScreen} options={{ title: "Authorised Settings" }}/></Stack.Navigator>;
}
