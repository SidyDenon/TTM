import { Stack } from "expo-router";
import Protected from "../../context/protected";

export default function UserLayout() {
  return (
    <Protected>
      <Stack screenOptions={{ headerShown: false }} />
    </Protected>
  );
}
