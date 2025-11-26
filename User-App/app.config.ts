import { ConfigContext, ExpoConfig } from "expo/config";

const projectId = process.env.EAS_PROJECT_ID || "d9ff4e1c-41e6-49eb-8a59-27b874102d9a";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Tow Truck Mali",
  slug: "towtruck",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/logo1.png",
  scheme: "userapp",
  userInterfaceStyle: "light",
  experiments: {
    typedRoutes: true,
  },
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "Cette application a besoin d'accéder à la caméra pour prendre des photos.",
      NSPhotoLibraryUsageDescription: "Cette application a besoin d'accéder à la galerie pour sélectionner des photos.",
      NSLocationWhenInUseUsageDescription:
        "Cette application utilise votre localisation pour identifier votre position pendant les dépannages.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Cette application a besoin d'accéder à votre position même en arrière-plan pour permettre au client de suivre votre progression en temps réel.",
      NSLocationAlwaysUsageDescription: "L'application a besoin d'accéder à votre position en permanence pour le suivi de mission.",
      NSLocationTemporaryUsageDescriptionDictionary: {
        default: "TowTruck a besoin de votre localisation temporaire pour router correctement l'opérateur et le client.",
      },
      UIBackgroundModes: ["location", "fetch"],
    },
  },
  android: {
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
    package: "com.ttm.app",
    googleServicesFile: "./android/app/google-services.json",
    config: {
      googleMaps: {
        apiKey: "AIzaSyABd2koHf-EyzT8Nj9kTJp1fUWYizbjFNI",
      },
    },
  },
  web: {
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
  ],
  extra: {
    router: {},
    eas: {
      projectId,
    },
  },
});
