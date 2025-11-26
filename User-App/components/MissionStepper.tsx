// components/MissionStepper.tsx
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type Step = { key: string; label: string };

interface MissionStepperProps {
  steps: Step[];
  currentIndex: number;
}

export function MissionStepper({ steps, currentIndex }: MissionStepperProps) {
  return (
    <View style={styles.stepperContainer}>
      {steps.map((step, index) => {
        const active = index <= currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[styles.stepCircle, active && styles.stepCircleActive]}
            >
              {active ? (
                <MaterialIcons name="check" size={14} color="#fff" />
              ) : (
                <Text style={styles.stepIndex}>{index + 1}</Text>
              )}
            </View>
            {!isLast && (
              <View
                style={[styles.stepLine, active && styles.stepLineActive]}
              />
            )}
            <Text
              style={[styles.stepLabel, active && styles.stepLabelActive]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  stepItem: { flex: 1, alignItems: "center" },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#555",
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#E53935",
    borderColor: "#E53935",
  },
  stepIndex: { color: "#aaa", fontSize: 11, fontWeight: "600" },
  stepLine: {
    position: "absolute",
    top: 11,
    right: -10,
    width: 20,
    height: 2,
    backgroundColor: "#444",
  },
  stepLineActive: { backgroundColor: "#E53935" },
  stepLabel: { marginTop: 4, fontSize: 10, color: "#777" },
  stepLabelActive: { color: "#fff", fontWeight: "600" },
});
