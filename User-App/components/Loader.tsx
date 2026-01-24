import React from "react";
import LottieView from "lottie-react-native";

const loaderAnim = require("../assets/animations/ttmload.json");

type LoaderProps = {
  size?: number;
  style?: object;
};

export default function Loader({ size = 300, style }: LoaderProps) {
  return (
    <LottieView
      source={loaderAnim}
      autoPlay
      loop
      style={[{ width: size, height: size }, style]}
    />
  );
}
