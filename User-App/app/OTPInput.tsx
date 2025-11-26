// components/OTPInput.tsx
import React, { useRef } from "react";
import { View, TextInput, StyleSheet } from "react-native";

interface OTPInputProps {
  code: string;
  setCode: (val: string) => void;
  length?: number;
  onComplete?: (val: string) => void; // ✅ callback auto-submit
}

export default function OTPInput({ code, setCode, length = 6, onComplete }: OTPInputProps) {
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    let newCode = code.split("");

    if (text.length > 1) {
      // cas si user colle tout
      newCode = text.split("").slice(0, length);
      setCode(newCode.join(""));
      if (newCode.join("").length === length) {
        onComplete?.(newCode.join(""));
      }
      return;
    }

    newCode[index] = text;
    const finalCode = newCode.join("");
    setCode(finalCode);

    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (finalCode.length === length) {
      onComplete?.(finalCode); // ✅ déclenche quand 6 chiffres saisis
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          style={styles.input}
          keyboardType="numeric"
          maxLength={1}
          value={code[i] || ""}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    width: 50,
    height: 60,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    backgroundColor: "#fff",
  },
});
