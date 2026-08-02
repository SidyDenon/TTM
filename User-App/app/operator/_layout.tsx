// app/operator/_layout.tsx
import { Stack } from "expo-router";
import Protected from "../../context/protected";
import useNotifications from "../../hooks/useNotifications";

export default function OperatorLayout() {
  useNotifications();

  return (
    <Protected>
      <Stack screenOptions={{ headerShown: false }} />
    </Protected>
  );
}
