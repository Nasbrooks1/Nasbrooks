import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const USER_ID = "guest";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["career", USER_ID], queryFn: () => api.getCareer(USER_ID) });
  const { data: replays } = useQuery({ queryKey: ["replays", USER_ID], queryFn: () => api.listReplays(USER_ID) });
  const level = data?.level ?? 1;
  const xp = data?.xp ?? 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120 }} testID="profile-screen">
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.eyebrow}>CHARACTER</Text>
        <Text style={styles.title}>Counselor</Text>

        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={54} color={colors.brandPrimary} />
          </View>
          <Text style={styles.name}>Guest Attorney</Text>
          <Text style={styles.rank}>{data?.rank || "Law Student"}</Text>
        </View>

        <View style={styles.statRow}>
          <Stat label="LEVEL" value={String(level)} />
          <Stat label="XP" value={String(xp)} />
          <Stat label="WINS" value={String(data?.completed_cases.length ?? 0)} />
        </View>

        <Text style={styles.sectionTitle}>Trials</Text>
        <Pressable
          testID="profile-replays"
          onPress={() => router.push("/replays")}
          style={({ pressed }) => [styles.card, { padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }, pressed && { opacity: 0.85 }]}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="film" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, fontWeight: "700" }}>My Replays</Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 2 }}>
              {replays?.length || 0} saved trial{(replays?.length || 0) === 1 ? "" : "s"} · view & share
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <Row icon="notifications" label="Notifications" value="On" />
          <Row icon="volume-high" label="Sound Effects" value="On" />
          <Row icon="phone-portrait" label="Haptics" value="On" />
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <Row icon="information-circle" label="Version" value="1.0.0" />
          <Row icon="warning" label="Disclaimer" value="Fictional simulator" />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 36, fontWeight: "600", marginTop: spacing.xs },
  avatarCard: { alignItems: "center", padding: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.brandPrimary },
  name: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: "600" },
  rank: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center" },
  statValue: { color: colors.brandPrimary, fontFamily: fonts.display, fontSize: 26, fontWeight: "600" },
  statLabel: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 20, marginTop: spacing.xxl, marginBottom: spacing.md, fontWeight: "600" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { flex: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 14 },
  rowValue: { color: colors.muted, fontFamily: fonts.text, fontSize: 13 },
});
