// app/operator/_layout.tsx
import { Stack } from "expo-router";
import Protected from "../../context/protected";

export default function OperatorLayout() {
  return (
    <Protected>
      <Stack screenOptions={{ headerShown: false }} />
    </Protected>
  );
}
