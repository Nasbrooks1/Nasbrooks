import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Replay, TranscriptLine } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function ReplayDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, isLoading } = useQuery<Replay>({
    queryKey: ["replay", id],
    queryFn: () => api.getReplay(id),
  });

  const onShare = async () => {
    if (!r) return;
    const header = `⚖️ ${r.case_title}\nVerdict: ${r.verdict}${r.sentence ? `\nSentence: ${r.sentence}` : ""}\nPlayed as ${r.role.toUpperCase()} · +${r.xp_earned} XP\n\n--- TRANSCRIPT ---\n`;
    const body = r.transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n\n");
    const disclaimer = "\n\n(Federal Trial — a cinematic courtroom simulator game.)";
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard?.writeText(header + body + disclaimer);
        Alert.alert("Copied", "Transcript copied to clipboard.");
      } else {
        await Share.share({ message: header + body + disclaimer, title: r.case_title });
      }
    } catch {}
  };

  const onDelete = async () => {
    if (!r) return;
    const confirm = Platform.OS === "web"
      ? window.confirm("Delete this replay?")
      : await new Promise<boolean>((res) =>
          Alert.alert("Delete Replay", "This cannot be undone.", [
            { text: "Cancel", style: "cancel", onPress: () => res(false) },
            { text: "Delete", style: "destructive", onPress: () => res(true) },
          ]),
        );
    if (!confirm) return;
    try {
      await api.deleteReplay(r.id);
      qc.invalidateQueries({ queryKey: ["replays", r.user_id] });
      router.back();
    } catch {}
  };

  if (isLoading || !r) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }

  const isGuilty = r.verdict === "GUILTY";

  return (
    <View style={styles.root} testID="replay-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="replay-back">
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>TRIAL REPLAY</Text>
          <Text style={styles.caseTitle} numberOfLines={1}>{r.case_title}</Text>
        </View>
        <Pressable onPress={onShare} style={styles.iconBtn} testID="replay-share">
          <Ionicons name="share-outline" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.iconBtn} testID="replay-delete">
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.verdictCard}>
          <Text style={styles.roleTag}>PLAYED AS {r.role.toUpperCase()}</Text>
          <Text style={[styles.verdictBig, { color: isGuilty ? colors.error : colors.success }]}>{r.verdict}</Text>
          {r.sentence && <Text style={styles.sentence}>{r.sentence}</Text>}
          <View style={styles.xpRow}>
            <Ionicons name="star" size={14} color={colors.brandPrimary} />
            <Text style={styles.xp}>+{r.xp_earned} XP</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.xp}>{r.transcript.length} transcript lines</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transcript</Text>
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {r.transcript.map((l: TranscriptLine, i) => (
            <Line key={i} l={l} />
          ))}
        </View>

        <Pressable onPress={onShare} style={styles.shareBtn} testID="replay-share-cta">
          <Ionicons name="share-social" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.shareText}>{Platform.OS === "web" ? "COPY TRANSCRIPT" : "SHARE THIS TRIAL"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Line({ l }: { l: TranscriptLine }) {
  const isJudge = l.role === "judge";
  const isSystem = l.role === "system";
  const isLawyer = l.role === "lawyer";
  const color = isJudge ? colors.brandPrimary : isSystem ? colors.muted : isLawyer ? colors.info : colors.onSurface;
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.speaker, { color }]}>{l.speaker}</Text>
      <Text style={[styles.text, isSystem && { fontStyle: "italic", color: colors.muted }]}>{l.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  caseTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 18, fontWeight: "600", marginTop: 2 },
  verdictCard: { padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", gap: spacing.xs },
  roleTag: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  verdictBig: { fontFamily: fonts.display, fontSize: 44, fontWeight: "700", letterSpacing: 2 },
  sentence: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: spacing.sm },
  xpRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  xp: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  metaDot: { color: colors.muted, fontFamily: fonts.text, fontSize: 12 },
  sectionTitle: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: spacing.xl },
  speaker: { fontFamily: fonts.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  text: { color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  shareBtn: { marginTop: spacing.xxl, height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  shareText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
