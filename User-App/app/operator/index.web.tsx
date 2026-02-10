import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OperatorIndexWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TTM Operateur</Text>
      <Text style={styles.subtitle}>
        L’écran carte n’est pas disponible sur le web.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
