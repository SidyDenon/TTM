declare module "*.png" {
  const value: any;
  export default value;
}

declare module "react-native-svg/lib/commonjs" {
  export * from "react-native-svg";
  const Svg: any;
  export default Svg;
}
