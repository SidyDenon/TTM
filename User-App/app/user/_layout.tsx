import { Stack } from "expo-router";
import Protected from "../../context/protected";
import useNotifications from "../../hooks/useNotifications";

export default function UserLayout() {
  useNotifications();

  return (
    <Protected>
      <Stack screenOptions={{ headerShown: false }} />
    </Protected>
  );
}
