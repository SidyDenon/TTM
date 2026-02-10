import React from "react";
import { View } from "react-native";

type Props = {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  style?: any;
};

export default function Lottie(props: Props) {
  return <View style={props.style} />;
}
