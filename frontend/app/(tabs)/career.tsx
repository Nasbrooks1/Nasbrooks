import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const RANKS = [
  { level: 1, name: "Law Student", icon: "school" as const },
  { level: 5, name: "Public Defender", icon: "shield-half" as const },
  { level: 10, name: "Defense Attorney", icon: "shield-checkmark" as const },
  { level: 20, name: "Federal Prosecutor", icon: "briefcase" as const },
  { level: 30, name: "Senior Trial Attorney", icon: "ribbon" as const },
  { level: 40, name: "Federal Judge", icon: "hammer" as const },
];
const USER_ID = "guest";

export default function CareerScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useQuery({ queryKey: ["career", USER_ID], queryFn: () => api.getCareer(USER_ID) });
  const level = data?.level ?? 1;
  const xp = data?.xp ?? 0;
  const nextLevelXp = level * 120;
  const pct = Math.min(1, xp / nextLevelXp);
  const currentRank = [...RANKS].reverse().find((r) => level >= r.level) || RANKS[0];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120 }} testID="career-screen">
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.eyebrow}>CAREER MODE</Text>
        <Text style={styles.title}>Your Path to{"\n"}the Bench</Text>

        <View style={styles.summaryCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={styles.iconCircle}>
              <Ionicons name={currentRank.icon} size={28} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankLabel}>CURRENT RANK</Text>
              <Text style={styles.rankName}>{currentRank.name}</Text>
              <Text style={styles.rankLevel}>Level {level} · {xp} / {nextLevelXp} XP</Text>
            </View>
          </View>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${pct * 100}%` }]} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Career Ladder</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        {RANKS.map((r, i) => {
          const unlocked = level >= r.level;
          const isCurrent = r.name === currentRank.name;
          return (
            <View key={r.name} style={[styles.rankRow, isCurrent && styles.rankRowActive]} testID={`rank-row-${i}`}>
              <View style={[styles.rankIcon, !unlocked && { opacity: 0.35 }]}>
                <Ionicons name={r.icon} size={20} color={unlocked ? colors.brandPrimary : colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankRowName, !unlocked && { color: colors.muted }]}>{r.name}</Text>
                <Text style={styles.rankRowLevel}>Unlocks at level {r.level}</Text>
              </View>
              {isCurrent && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>YOU</Text>
                </View>
              )}
              {!unlocked && !isCurrent && <Ionicons name="lock-closed" size={14} color={colors.muted} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 36, fontWeight: "600", marginTop: spacing.xs, lineHeight: 40 },
  summaryCard: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rankLabel: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  rankName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: "600", marginTop: 2 },
  rankLevel: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 12, marginTop: 2 },
  xpBar: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, fontWeight: "600", marginTop: spacing.xxl, marginBottom: spacing.md },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rankRowActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  rankIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rankRowName: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 15, fontWeight: "700" },
  rankRowLevel: { color: colors.muted, fontFamily: fonts.text, fontSize: 11, marginTop: 2 },
  activeBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  activeBadgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});
