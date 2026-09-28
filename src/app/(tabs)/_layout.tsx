import { useEffect } from "react";
import { AppState, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, shadow } from "../../theme";
import { flushPending, reattachIfWalking } from "../../walk/controller";
import { pruneFinished } from "../../walk/store";

type IconName = "today" | "walk" | "backers" | "hero";

function Icon({ name, color }: { name: IconName; color: ColorValue }) {
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
      {name === "backers" && (
        <>
          <Circle cx={9} cy={8.5} r={3.3} />
          <Path d="M3.5 19c.7-3.3 2.9-5.2 5.5-5.2s4.8 1.9 5.5 5.2" />
          <Path d="M15 5.6a3.2 3.2 0 010 6M17 13.9c2 .6 3.2 2.3 3.6 5.1" />
        </>
      )}
      {name === "hero" && <Path d="M12 3l2.7 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6l-5.5 3 1.2-6.1-4.5-4.2 6.1-.7z" />}
    </Svg>
  );
}

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Today", icon: "today" },
  { name: "walk", title: "Walk", icon: "walk" },
  { name: "backers", title: "Backers", icon: "backers" },
  { name: "hero", title: "Hero", icon: "hero" },
];

/** v3 floating tab bar: a white pill that sits above the bottom edge. */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[bar.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[bar.pill, shadow.card]}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          const color = focused ? colors.red : colors.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              style={bar.item}
            >
              <Icon name={tab.icon} color={color} />
              <Text style={[bar.label, { color }]}>{tab.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  pill: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 30,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  item: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 },
  label: { fontFamily: fonts.bold, fontSize: 11.5 },
});

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
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
