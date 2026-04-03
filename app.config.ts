import type { ConfigContext, ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.GOOGLE_MAPS_PLATFORM_API_KEY;

if (!googleMapsApiKey) {
  throw new Error(
    "Missing GOOGLE_MAPS_PLATFORM_API_KEY. Add it to your .env file in the project root."
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "QuietSpace",
  slug: "QuietSpace",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "quietspace",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    ...(config.ios ?? {}),
    supportsTablet: config.ios?.supportsTablet ?? true,
    config: {
      ...(config.ios?.config ?? {}),
      googleMapsApiKey,
    },
  },
  android: {
    ...(config.android ?? {}),
    adaptiveIcon: {
      ...(config.android?.adaptiveIcon ?? {}),
      backgroundColor:
        config.android?.adaptiveIcon?.backgroundColor ?? "#E6F4FE",
      foregroundImage:
        config.android?.adaptiveIcon?.foregroundImage ??
        "./assets/images/android-icon-foreground.png",
      backgroundImage:
        config.android?.adaptiveIcon?.backgroundImage ??
        "./assets/images/android-icon-background.png",
      monochromeImage:
        config.android?.adaptiveIcon?.monochromeImage ??
        "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: config.android?.edgeToEdgeEnabled ?? true,
    predictiveBackGestureEnabled:
      config.android?.predictiveBackGestureEnabled ?? false,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: {
        ...(config.android?.config?.googleMaps ?? {}),
        apiKey: googleMapsApiKey,
      },
    },
  },
  web: {
    ...(config.web ?? {}),
    output: config.web?.output ?? "static",
    favicon: config.web?.favicon ?? "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...(config.extra ?? {}),
    googleMapsApiConfigured: true,
    googleMapsApiKey,
  },
});