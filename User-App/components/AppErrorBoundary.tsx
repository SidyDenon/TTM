import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.error("Erreur interface mobile:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Un problème est survenu</Text>
        <Text style={styles.message}>L’écran n’a pas pu être affiché. Vos données ne sont pas perdues.</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", color: "#1f2937", marginBottom: 10, textAlign: "center" },
  message: { fontSize: 15, lineHeight: 22, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#E53935", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
