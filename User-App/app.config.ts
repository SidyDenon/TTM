import { ConfigContext, ExpoConfig } from "expo/config";

const ANDROID_MAPS_KEY_FALLBACK = "AIzaSyABd2koHf-EyzT8Nj9kTJp1fUWYizbjFNI";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Tow Truck Mali",
  slug: "towtruck", // EAS vient de créer le projet @sidydenon63/towtruck
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/logo1.png",
  scheme: "userapp",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  experiments: {
    typedRoutes: true,
  },

  ios: {
    ...config.ios,
    supportsTablet: true,
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSCameraUsageDescription:
        "Cette application a besoin d'accéder à la caméra pour prendre des photos.",
      NSPhotoLibraryUsageDescription:
        "Cette application a besoin d'accéder à la galerie pour sélectionner des photos.",
      NSLocationWhenInUseUsageDescription:
        "Cette application utilise votre localisation pour identifier votre position pendant les dépannages.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Cette application a besoin d'accéder à votre position même en arrière-plan pour permettre au client de suivre votre progression en temps réel.",
      NSLocationAlwaysUsageDescription:
        "L'application a besoin d'accéder à votre position en permanence pour le suivi de mission.",
      NSLocationUsageDescription:
        "TowTruck utilise votre localisation pour afficher et suivre les missions.",
      NSLocationTemporaryUsageDescriptionDictionary: {
        default:
          "TowTruck a besoin de votre localisation temporaire pour router correctement l'opérateur et le client.",
      },
      UIBackgroundModes: ["location", "fetch"],
    },
  },

   android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: "./assets/images/logo1.png",
      backgroundColor: "#000000",
    },
    edgeToEdgeEnabled: true,
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "POST_NOTIFICATIONS",
    ],
    // 👉 package final pour Play Store
    package: "com.towtruckmali.app",
    // ❌ on retire googleServicesFile pour le moment
    config: {
      googleMaps: {
        apiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          process.env.GOOGLE_MAPS_API_KEY ||
          ANDROID_MAPS_KEY_FALLBACK,
      },
    },
  },


  web: {
    ...config.web,
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/logo1.png",
        imageWidth: 200,
        resizeMode: "cover",
        backgroundColor: "#000000",
      },
    ],
    "expo-font",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#E5372E",
      },
    ],
    [
      "expo-location",
      {
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    "expo-web-browser",
  ],

  extra: {
    // 🟢 Très important : on garde extra, et on laisse EAS gérer eas.projectId
    ...(config.extra || {}),
    router: {
      ...(config.extra?.router || {}),
    },
    eas: {
      ...(config.extra?.eas || {}),
      // ⚠️ PAS de projectId ici, EAS va l’ajouter lui-même
    },
  },
});
