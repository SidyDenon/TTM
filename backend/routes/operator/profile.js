import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CGU() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📄 Conditions Générales d’Utilisation</Text>

        {/* 1. Objet */}
        <Text style={styles.sectionTitle}>1. Objet</Text>
        <Text style={styles.text}>
          Les présentes Conditions Générales d’Utilisation (CGU) encadrent
          l’utilisation de l’application TTM (Tow Truck Mali). Elles définissent
          les droits et obligations des utilisateurs, des opérateurs et de
          l’administration TTM.
        </Text>

        {/* 2. Services proposés */}
        <Text style={styles.sectionTitle}>2. Services proposés</Text>
        <Text style={styles.text}>
          TTM permet aux utilisateurs de demander un dépannage automobile, un
          remorquage ou tout service associé. Les opérateurs partenaires réalisent
          les missions selon disponibilité dans leur zone.
        </Text>

        {/* 3. Responsabilités des opérateurs */}
        <Text style={styles.sectionTitle}>3. Responsabilités des opérateurs</Text>
        <Text style={styles.text}>
          L’opérateur s’engage à :
          {"\n"}• Fournir un service sérieux, professionnel et sécurisé.
          {"\n"}• Respecter les délais et accepter uniquement les missions qu’il peut réaliser.
          {"\n"}• Maintenir son profil, ses informations et sa disponibilité à jour.
          {"\n"}• Respecter les clients et agir conformément aux lois locales.
        </Text>

        {/* 4. Responsabilités des utilisateurs */}
        <Text style={styles.sectionTitle}>4. Responsabilités des clients</Text>
        <Text style={styles.text}>
          Le client s’engage à transmettre des informations exactes, à ne pas créer
          de fausses demandes et à respecter le personnel opérateur.
        </Text>

        {/* 5. Paiements & Transactions */}
        <Text style={styles.sectionTitle}>5. Paiements et retraits</Text>
        <Text style={styles.text}>
          Les paiements liés aux missions sont enregistrés dans l’application.
          {"\n"}• Les gains des opérateurs sont soumis à une commission définie par TTM.
          {"\n"}• Les retraits sont effectués via les méthodes supportées et doivent être validés par l’administrateur.
          {"\n"}• Toute tentative de fraude entraînera une suspension immédiate du compte.
        </Text>

        {/* 6. Annulation & litiges */}
        <Text style={styles.sectionTitle}>6. Annulation et litiges</Text>
        <Text style={styles.text}>
          Une mission peut être annulée par l’utilisateur ou par TTM en cas
          d’indisponibilité, de comportement inapproprié ou d’informations
          incorrectes. Les litiges sont traités par l’équipe TTM.
        </Text>

        {/* 7. Données personnelles */}
        <Text style={styles.sectionTitle}>7. Données personnelles</Text>
        <Text style={styles.text}>
          TTM collecte des informations nécessaires au bon fonctionnement des
          services : identité, localisation, téléphone, historique de missions.
          {"\n"}Ces données ne sont jamais revendues et restent confidentielles.
          {"\n"}L’utilisateur peut demander la suppression de son compte à tout moment.
        </Text>

        {/* 8. Géolocalisation */}
        <Text style={styles.sectionTitle}>8. Géolocalisation</Text>
        <Text style={styles.text}>
          L’application utilise la position du client et de l’opérateur afin de
          localiser la panne, suivre le déplacement de la dépanneuse et optimiser
          les missions. L’activation de la localisation est obligatoire.
        </Text>

        {/* 9. Sécurité & limitations */}
        <Text style={styles.sectionTitle}>9. Sécurité et limitations</Text>
        <Text style={styles.text}>
          Malgré tous les efforts réalisés, TTM ne peut garantir une disponibilité
          permanente du service. L’application ne peut être tenue responsable des
          dommages indirects liés à l’utilisation du service.
        </Text>

        {/* 10. Suspension des comptes */}
        <Text style={styles.sectionTitle}>10. Suspension des comptes</Text>
        <Text style={styles.text}>
          TTM se réserve le droit de suspendre ou supprimer un compte en cas de :
          {"\n"}• Fraude,
          {"\n"}• Abus,
          {"\n"}• Non-respect des CGU,
          {"\n"}• Informations fausses ou trompeuses.
        </Text>

        {/* 11. Acceptation des CGU */}
        <Text style={styles.sectionTitle}>11. Acceptation</Text>
        <Text style={styles.text}>
          En utilisant l’application, vous reconnaissez avoir lu, compris et
          accepté ces Conditions Générales d’Utilisation.
        </Text>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#E53935",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 5,
    color: "#E53935",
  },
  text: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
    textAlign: "justify",
  },
});
