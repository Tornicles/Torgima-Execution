import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { DashboardScreen } from "../screens/Dashboard/DashboardScreen";
import { TaskScreen } from "../screens/Task/TaskScreen";
import { ChatScreen } from "../screens/Chat/ChatScreen";
import { PrinciplesScreen } from "../screens/Principles/PrinciplesScreen";
import { ProfileScreen } from "../screens/Profile/ProfileScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: "🏠",
    Task: "✓",
    Chat: "💬",
    Principles: "⚡",
    Profile: "👤",
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? "•"}</Text>
  );
}

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#5b21b6",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Task" component={TaskScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Principles" component={PrinciplesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
