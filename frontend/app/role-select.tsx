import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

const { width } = Dimensions.get("window");
const CARD_W = width - spacing.xl * 2;

const ROLES = [
  { key: "prosecutor", name: "Federal Prosecutor", tagline: "Build the case. Present the evidence. Seek justice.", duties: ["Investigate the case", "Select charges", "Present evidence", "Call witnesses", "Cross-examine", "Deliver closing"], image: "https://images.pexels.com/photos/34817106/pexels-photo-34817106.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { key: "defense", name: "Defense Attorney", tagline: "Every client deserves a defense. Fight for the record.", duties: ["Investigate", "Challenge evidence", "File motions", "Cross-examine", "Present defenses", "Deliver closing"], image: "https://images.pexels.com/photos/32907709/pexels-photo-32907709.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { key: "judge", name: "Judge", tagline: "Rule the courtroom. Interpret the law. Sentence the guilty.", duties: ["Control procedure", "Rule on objections", "Decide admissibility", "Instruct the jury", "Sentence"], image: "https://images.pexels.com/photos/34817069/pexels-photo-34817069.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { key: "defendant", name: "Defendant", tagline: "Your freedom is on the line. Choose your path.", duties: ["Decide with counsel", "Testify or not", "Accept or reject pleas", "Participate at trial"], image: "https://images.pexels.com/photos/7773261/pexels-photo-7773261.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { key: "agent", name: "Federal Agent", tagline: "Build the file. Follow the leads. Bring in the evidence.", duties: ["Investigate cases", "Interview witnesses", "Collect evidence", "Build the file"], image: "https://images.pexels.com/photos/24425381/pexels-photo-24425381.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
  { key: "jury", name: "Jury", tagline: "Weigh the evidence. Deliberate. Deliver the verdict.", duties: ["Hear evidence", "Evaluate testimony", "Deliberate", "Decide guilt"], image: "https://images.pexels.com/photos/6077430/pexels-photo-6077430.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" },
];

export default function RoleSelect() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  const [index, setIndex] = useState(0);
  const selected = ROLES[index];

  const onContinue = () => {
    // For MVP flow: navigate to the first case brief with chosen role.
    router.push({ pathname: "/case/[id]", params: { id: "case-johnson-1047", role: selected.key, quick: quick || "" } });
  };

  return (
    <View style={styles.root} testID="role-select-screen">
      <FlatList
        data={ROLES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(r) => r.key}
        snapToInterval={CARD_W + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: insets.top + 80, gap: spacing.md }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + spacing.md)))}
        renderItem={({ item, index: i }) => (
          <View style={[styles.card, { width: CARD_W }]} testID={`role-card-${item.key}`}>
            <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(10,11,14,0.15)", "rgba(10,11,14,0.85)", "rgba(10,11,14,0.98)"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cardBody}>
              <Text style={styles.roleEyebrow}>ROLE {i + 1} OF {ROLES.length}</Text>
              <Text style={styles.roleName}>{item.name}</Text>
              <Text style={styles.roleTagline}>{item.tagline}</Text>
              <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
                {item.duties.map((d) => (
                  <View key={d} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                    <Ionicons name="checkmark" size={14} color={colors.brandPrimary} />
                    <Text style={styles.duty}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + spacing.md }]} testID="role-back">
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>

      <View style={styles.dots}>
        {ROLES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable style={styles.ctaBtn} onPress={onContinue} testID="role-continue">
          <Text style={styles.ctaText}>PLAY AS {selected.name.toUpperCase()}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  card: { height: "78%", borderRadius: radius.lg, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardBody: { flex: 1, padding: spacing.xl, justifyContent: "flex-end" },
  roleEyebrow: { color: colors.brandPrimary, fontFamily: fonts.text, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  roleName: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 40, fontWeight: "600", marginTop: spacing.xs, lineHeight: 42 },
  roleTagline: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  duty: { color: colors.onSurfaceSecondary, fontFamily: fonts.text, fontSize: 13 },
  back: { position: "absolute", left: spacing.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(20,22,28,0.6)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary },
  dotActive: { backgroundColor: colors.brandPrimary, width: 18 },
  cta: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  ctaBtn: { backgroundColor: colors.brandPrimary, height: 56, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ctaText: { color: colors.onBrandPrimary, fontFamily: fonts.text, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
});
