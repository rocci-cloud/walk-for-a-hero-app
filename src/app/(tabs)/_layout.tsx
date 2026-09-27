import { useEffect } from "react";
import { AppState, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts } from "../../theme";
import { flushPending, reattachIfWalking } from "../../walk/controller";
import { pruneFinished } from "../../walk/store";

function Icon({ name, color }: { name: "today" | "walk" | "account"; color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {name === "today" && (
        <>
          <Circle cx={12} cy={12} r={8.5} />
          <Circle cx={12} cy={12} r={5} />
        </>
      )}
      {name === "walk" && (
        <>
          <Path d="M4 19c3-1 3-6 7-6s4-7 9-8" />
          <Circle cx={4} cy={19} r={1.5} />
          <Circle cx={20} cy={5} r={1.5} />
        </>
      )}
      {name === "account" && (
        <>
          <Circle cx={12} cy={8} r={3.8} />
          <Path d="M4.5 20c.9-3.8 3.8-6 7.5-6s6.6 2.2 7.5 6" />
        </>
      )}
    </Svg>
  );
}

export default function TabsLayout() {
  // Keep an active walk attached to GPS and push any unsent walk whenever the
  // app comes back to the foreground.
  useEffect(() => {
    const kick = () => {
      reattachIfWalking().catch(() => {});
      flushPending().catch(() => {});
    };
    kick();
    try {
      pruneFinished(Date.now());
    } catch {
      /* housekeeping only */
    }
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") kick();
    });
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.hairline },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ color }) => <Icon name="today" color={color} /> }} />
      <Tabs.Screen name="walk" options={{ title: "Walk", tabBarIcon: ({ color }) => <Icon name="walk" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <Icon name="account" color={color} /> }} />
    </Tabs>
  );
}
