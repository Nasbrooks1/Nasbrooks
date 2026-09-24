import Ionicons from "@react-native-vector-icons/ionicons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

const HERO = "https://images.pexels.com/photos/6077326/pexels-photo-6077326.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

type Action = { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; route?: any; primary?: boolean };
const ACTIONS: Action[] = [
  { key: "play", label: "PLAY", icon: "play", route: "/role-select", primary: true },
  { key: "career", label: "CAREER MODE", icon: "trending-up", route: "/(tabs)/career" },
  { key: "quick", label: "QUICK TRIAL", icon: "flash", route: "/role-select?quick=1" },
  { key: "cases", label: "CASE LIBRARY", icon: "folder-open", route: "/(tabs)/cases" },
  { key: "create", label: "CREATE CASE", icon: "add-circle-outline" },
  { key: "character", label: "CHARACTER", icon: "person-circle", route: "/(tabs)/profile" },
  { key: "multi", label: "MULTIPLAYER", icon: "people" },
  { key: "settings", label: "SETTINGS", icon: "settings-outline" },
];

export default function MainMenu() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient
        colors={["rgba(10,11,14,0.4)", "rgba(10,11,14,0.85)", "rgba(10,11,14,0.98)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.eyebrow}>FEDERAL COURTHOUSE</Text>
        <Text style={styles.title}>Federal{"\n"}Trial</Text>
        <Text style={styles.subtitle}>A cinematic federal courtroom simulator.</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              testID={`menu-${a.key}`}
              onPress={() => a.route && router.push(a.route)}
              style={({ pressed }) => [
                styles.tile,
                a.primary && styles.tilePrimary,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
            >
              {Platform.OS !== "web" && !a.primary && (
                <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
              )}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: a.primary ? "transparent" : "rgba(20,22,28,0.7)" }]} />
              <Ionicons name={a.icon} size={a.primary ? 26 : 22} color={a.primary ? colors.onBrandPrimary : colors.brandPrimary} />
              <Text style={[styles.tileLabel, a.primary && styles.tileLabelPrimary]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: {
    color: colors.brandPrimary,
    fontFamily: fonts.text,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
  },
  title: {
    color: colors.onSurface,
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 56,
    fontWeight: "600",
    marginTop: spacing.sm,
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontFamily: fonts.text,
    fontSize: 14,
    marginTop: spacing.md,
    letterSpacing: 0.3,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  tile: {
    width: "48%",
    height: 92,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tilePrimary: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
    width: "100%",
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  tileLabel: {
    color: colors.onSurface,
    fontFamily: fonts.text,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  tileLabelPrimary: { color: colors.onBrandPrimary, fontSize: 16, letterSpacing: 3 },
});
