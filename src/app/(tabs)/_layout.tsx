import { useEffect, useState } from "react";
import { Animated, AppState, Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, shadow } from "../../theme";
import { curve, tap } from "../../components/motion";
import { flushPending, reattachIfWalking } from "../../walk/controller";
import { pruneFinished } from "../../walk/store";

type IconName = "today" | "walk" | "backers" | "hero";

/** One drawn family at one weight (1.8). A filled variant marks the active tab. */
function Icon({ name, color, active }: { name: IconName; color: ColorValue; active: boolean }) {
  const fill = active ? color : "none";
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {name === "today" && (
        // A medal: the ring of the emblem with the star inside.
        <>
          <Circle cx={12} cy={13} r={7.5} />
          <Path d="M8.5 6.5L7 2.5h10l-1.5 4" />
          <Path d="M12 9.2l1.2 2.4 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z" fill={fill} strokeWidth={active ? 0 : 1.4} />
        </>
      )}
      {name === "walk" && (
        // Two footprints, one ahead of the other.
        <>
          <Path d="M7.5 3.5c1.6 0 2.5 1.6 2.5 3.6 0 1.7-.6 3.2-1.8 3.9L8 13.5c-.2 1-1.2 1.4-2 1.1-.9-.3-1.3-1.2-1-2.1l.3-2.6C4.6 8.5 4.5 7 4.8 5.8 5.2 4.4 6.1 3.5 7.5 3.5z" fill={fill} />
          <Path d="M16.5 9.5c1.4 0 2.3 1 2.7 2.4.3 1.2.2 2.7-.5 4.1l.3 2.6c.3.9-.1 1.8-1 2.1-.8.3-1.8-.1-2-1.1l-.2-2.5c-1.2-.7-1.8-2.2-1.8-3.9 0-2 .9-3.7 2.5-3.7z" fill={fill} />
        </>
      )}
      {name === "backers" && (
        <>
          <Circle cx={9} cy={8.5} r={3.3} />
          <Path d="M3.5 19c.7-3.3 2.9-5.2 5.5-5.2s4.8 1.9 5.5 5.2" />
          <Path d="M15 5.6a3.2 3.2 0 010 6M17 13.9c2 .6 3.2 2.3 3.6 5.1" />
        </>
      )}
      {name === "hero" && <Path d="M12 3l2.7 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6l-5.5 3 1.2-6.1-4.5-4.2 6.1-.7z" fill={fill} />}
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
      <View style={[bar.pill, shadow.float]}>
        {state.routes.map((route, i) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <TabItem
              key={route.key}
              title={tab.title}
              icon={tab.icon}
              focused={focused}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) {
                  tap.select();
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ title, icon, focused, onPress }: { title: string; icon: IconName; focused: boolean; onPress: () => void }) {
  const [v] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    Animated.timing(v, { toValue: focused ? 1 : 0, duration: 260, easing: curve, useNativeDriver: true }).start();
  }, [focused, v]);
  const color = focused ? colors.red : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} onPress={onPress} style={bar.item}>
      <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
        <Icon name={icon} color={color} active={focused} />
      </Animated.View>
      <Text style={[bar.label, { color }]}>{title}</Text>
    </Pressable>
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
