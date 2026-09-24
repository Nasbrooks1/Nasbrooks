import Ionicons from "@react-native-vector-icons/ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const USER_ID = "guest";

export default function Verdict() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id, role = "prosecutor", stats: statsStr } = useLocalSearchParams<{ id: string; role?: string; stats?: string }>();
  const stats = statsStr
    ? JSON.parse(statsStr as string)
    : { objections_won: 0, objections_lost: 0, evidence_introduced: 0, witnesses_examined: 0, contradictions_exposed: 0, motions_granted: 0, motions_denied: 0 };

  const { data: c } = useQuery({ queryKey: ["case", id], queryFn: () => api.getCase(id) });

  const verdictQ = useMutation({
    mutationFn: () =>
      api.verdict({
        case_id: id!,
        stats: { case_id: id!, role: String(role), ...stats },
      }),
  });

  useEffect(() => {
    if (!verdictQ.data && !verdictQ.isPending && c) {
      verdictQ.mutate();
    }
  }, [c, verdictQ]);

  // Save XP on verdict
  useEffect(() => {
    if (!verdictQ.data) return;
    (async () => {
      try {
        const cur = await api.getCareer(USER_ID);
        const newXp = cur.xp + (verdictQ.data?.xp_earned || 0);
        const newLevel = Math.max(1, Math.floor(newXp / 120) + 1);
        await api.saveCareer({
          user_id: USER_ID,
          level: newLevel,
          xp: newXp,
          rank: cur.rank,
          role_focus: String(role),
          completed_cases: Array.from(new Set([...(cur.completed_cases || []), id!])),
        });
        qc.invalidateQueries({ queryKey: ["career", USER_ID] });
      } catch {}
    })();
  }, [verdictQ.data]);

  if (!c || verdictQ.isPending || !verdictQ.data) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]} testID="verdict-loading">
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text style={styles.loading}>THE JURY IS DELIBERATING…</Text>
      </View>
    );
  }

  const v = verdictQ.data;
  const isGuilty = v.verdict === "GUILTY";
  const anyGuilty = Object.values(v.per_charge).includes("GUILTY");

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 }} testID="verdict-screen">
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.eyebrow}>JURY VERDICT</Text>
        <Text style={[styles.verdictBig, { color: isGuilty ? colors.error : colors.success }]}>{v.verdict}</Text>
        <Text style={styles.caseName}>{c.title} · Case #{c.case_number}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Per-Charge Findings</Text>
          {Object.entries(v.per_charge).map(([ch, r]) => (
            <View key={ch} style={styles.chargeRow}>
              <Text style={styles.chargeLabel} numberOfLines={2}>{ch}</Text>
              <View style={[styles.badge, r === "GUILTY" ? styles.badgeGuilty : styles.badgeNot]}>
                <Text style={[styles.badgeText, { color: r === "GUILTY" ? colors.onError : colors.onSuccess }]}>{r}</Text>
              </View>
            </View>
          ))}
        </View>

        {v.sentence && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sentence</Text>
            <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start", marginTop: spacing.sm }}>
              <Ionicons name="hammer" size={20} color={colors.brandPrimary} />
              <Text style={styles.sentence}>{v.sentence}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Jury Summary</Text>
          <Text style={styles.summary}>{v.summary}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trial Performance</Text>
          <View style={styles.statGrid}>
            <StatCell n={stats.evidence_introduced} label="Evidence" />
            <StatCell n={stats.objections_won} label="Obj. Won" good />
            <StatCell n={stats.objections_lost} label="Obj. Lost" bad />
            <StatCell n={stats.contradictions_exposed} label="Contradict." good />
          </View>
        </View>

        <View style={styles.xpCard}>
          <Ionicons name="star" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.xpText}>+{v.xp_earned} XP EARNED</Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xl }}>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/cases")} testID="verdict-lib">
            <Text style={styles.secondaryText}>CASE LIBRARY</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")} testID="verdict-home">
            <Text style={styles.primaryText}>HOME</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCell({ n, label, good, bad }: { n: number; label: string; good?: boolean; bad?: boolean }) {
  const color = good ? colors.success : bad ? colors.error : colors.brandPrimary;
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statNum, { color }]}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loading: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700", marginTop: spacing.lg },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  verdictBig: { fontFamily: fonts.display, fontSize: 64, fontWeight: "700", marginTop: spacing.sm, letterSpacing: 2 },
  caseName: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, marginTop: spacing.xs },
  card: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sectionTitle: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  chargeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.md },
  chargeLabel: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 13, flex: 1 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeGuilty: { backgroundColor: colors.error },
  badgeNot: { backgroundColor: colors.success },
  badgeText: { fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  sentence: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  summary: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  statCell: { width: "47%", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, alignItems: "center", gap: 2 },
  statNum: { fontFamily: fonts.display, fontSize: 28, fontWeight: "600" },
  statLabel: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  xpCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md },
  xpText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  primaryBtn: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondaryBtn: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
