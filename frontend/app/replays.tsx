import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Replay } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const USER_ID = "guest";

export default function ReplaysList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["replays", USER_ID],
    queryFn: () => api.listReplays(USER_ID),
  });

  return (
    <View style={styles.root} testID="replays-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="replays-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MY TRIALS</Text>
          <Text style={styles.title}>Replays</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(r) => r.id}
          onRefresh={refetch}
          refreshing={isFetching}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.md }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="film-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>No trials yet</Text>
              <Text style={styles.emptySub}>Finish a case and your full transcript will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => <ReplayRow r={item} onPress={() => router.push({ pathname: "/replay/[id]", params: { id: item.id } })} />}
        />
      )}
    </View>
  );
}

function ReplayRow({ r, onPress }: { r: Replay; onPress: () => void }) {
  const isGuilty = r.verdict === "GUILTY";
  const date = new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <Pressable testID={`replay-${r.id}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={[styles.verdictDot, { backgroundColor: isGuilty ? colors.error : colors.success }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.caseTitle} numberOfLines={1}>{r.case_title}</Text>
        <Text style={styles.meta}>{r.role.toUpperCase()} · {r.transcript.length} LINES · {date}</Text>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: isGuilty ? colors.error : colors.success }]}>
            <Text style={styles.pillText}>{r.verdict}</Text>
          </View>
          <View style={styles.xpPill}>
            <Ionicons name="star" size={10} color={colors.brandPrimary} />
            <Text style={styles.xpText}>+{r.xp_earned} XP</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: 4 },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 32, fontWeight: "600", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, fontWeight: "600", marginTop: spacing.md },
  emptySub: { color: colors.muted, fontFamily: fonts.text, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  verdictDot: { width: 10, height: 10, borderRadius: 5 },
  caseTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, fontWeight: "600" },
  meta: { color: colors.muted, fontFamily: fonts.text, fontSize: 11, letterSpacing: 1, marginTop: 2, fontWeight: "600" },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { color: colors.onError, fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  xpPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  xpText: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});
