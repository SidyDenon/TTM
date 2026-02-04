import React from "react";
import { Platform, View } from "react-native";

type Props = {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  style?: any;
};

export default function Lottie(props: Props) {
  if (Platform.OS === "web") {
    return <View style={props.style} />;
  }
  // Lazy require to avoid web bundle importing lottie-react-native internals
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const LottieView = require("lottie-react-native").default;
  return <LottieView {...props} />;
}
