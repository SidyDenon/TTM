import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === "operator") {
          router.replace("/operator");
        } else {
          router.replace("/user");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [loading, user]);

  return null;
}
