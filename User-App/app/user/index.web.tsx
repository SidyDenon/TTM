import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function UserIndexWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TTM Client</Text>
      <Text style={styles.subtitle}>
        La carte n’est pas disponible sur le web.
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
