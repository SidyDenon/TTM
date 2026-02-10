import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SearchingOperatorsWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recherche d’opérateur</Text>
      <Text style={styles.subtitle}>
        Cet écran est disponible uniquement sur mobile.
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
