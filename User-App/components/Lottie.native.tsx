import React from "react";
import LottieView from "lottie-react-native";

type Props = {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  style?: any;
};

export default function Lottie(props: Props) {
  return <LottieView {...props} />;
}
