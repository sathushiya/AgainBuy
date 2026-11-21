import { StyleProp, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { againBuyIconXml, againBuyLogoXml } from "../assets/againbuyLogo";

interface AgainBuyLogoProps {
  width?: number;
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function AgainBuyLogo({ width = 180, iconOnly = false, style, accessibilityLabel = "AgainBuy — Buy, Sell, Give New Life" }: AgainBuyLogoProps) {
  const ratio = iconOnly ? 1 : 600 / 230;
  return <SvgXml accessibilityLabel={accessibilityLabel} xml={iconOnly ? againBuyIconXml : againBuyLogoXml} width={width} height={width / ratio} style={style}/>;
}
