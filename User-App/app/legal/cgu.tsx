import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CGU() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📄 Conditions Générales d’Utilisation</Text>
        
        <Text style={styles.sectionTitle}>1. Objet</Text>
        <Text style={styles.text}>
          Ces Conditions Générales d’Utilisation (CGU) encadrent l’utilisation de l’application TTM.
        </Text>

        <Text style={styles.sectionTitle}>2. Responsabilités</Text>
        <Text style={styles.text}>
          L’opérateur s’engage à respecter les missions et à fournir un service de qualité.
        </Text>

        <Text style={styles.sectionTitle}>3. Paiements</Text>
        <Text style={styles.text}>
          Les paiements et retraits sont soumis à validation et vérification par l’administrateur.
        </Text>

        <Text style={styles.sectionTitle}>4. Données personnelles</Text>
        <Text style={styles.text}>
          Vos données sont protégées et utilisées uniquement dans le cadre du service.
        </Text>

        <Text style={styles.sectionTitle}>5. Acceptation</Text>
        <Text style={styles.text}>
          En utilisant l’application, vous acceptez ces conditions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15, color: "#E53935", textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginTop: 15, marginBottom: 5, color: "#E53935" },
  text: { fontSize: 14, color: "#333", lineHeight: 22, textAlign: "justify" },
});
