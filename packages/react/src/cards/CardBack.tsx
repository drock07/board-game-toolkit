import { useId, type CSSProperties, type ReactNode } from "react";
import { useCardDimensionsContext } from "./CardDimensionsContext";
import { CardShape, type CardShapeProps } from "./CardShape";

export const PATTERNS = [
  "blue",
  "red",
  "green",
  "diamonds",
  "flowers",
  "pixelHearts",
] as const;
export type CardBackPattern = (typeof PATTERNS)[number];

export interface CardBackProps {
  /** Card width in pixels. Passed through to CardShape. */
  cardWidth?: CardShapeProps["cardWidth"];
  /** Width-to-height ratio. Passed through to CardShape. */
  aspectRatio?: CardShapeProps["aspectRatio"];
  /** Back design pattern. Default: "dots" */
  pattern?: CardBackPattern;
  /** Additional CSS class name applied to the root CardShape. */
  className?: string;
  /** Style overrides merged on top of defaults. */
  style?: CSSProperties;
}

const CARD_BG_COLOR = "rgb(255, 255, 255)";

export function CardBack({
  cardWidth,
  aspectRatio,
  pattern = "blue",
  className,
  style,
}: CardBackProps) {
  const { width: inheritedWidth } = useCardDimensionsContext();
  const width = cardWidth ?? inheritedWidth;
  const cardBgColor = CARD_BG_COLOR;

  let patternFill: ReactNode = null;

  switch (pattern) {
    case "diamonds":
      patternFill = <DiamondsPattern />;
      break;
    case "flowers":
      patternFill = <FlowersPattern />;
      break;
    case "pixelHearts":
      patternFill = <PixelHearts />;
      break;
    case "blue":
    case "red":
    case "green":
      patternFill = <SimplePattern pattern={pattern} />;
      break;
  }

  return (
    <CardShape
      cardWidth={cardWidth}
      aspectRatio={aspectRatio}
      className={className}
      style={{
        ...{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cardBgColor,
        },
        ...style,
      }}
    >
      {patternFill}
    </CardShape>
  );
}

function DiamondsPattern() {
  return (
    <Pattern
      bgColor="#2b2b31"
      patternWidth={14}
      patternHeight={28}
      translateX={1}
      viewBox="0 0 50 100"
    >
      <path
        fill="#ecc94b"
        d="M12.5 0 0 25l12.5 25L25 25zm25 50L25 75l12.5 25L50 75z"
      />
      <path
        fill="#f44034"
        d="M37.5 0 50 25 37.5 50 25 25zm-25 50L25 75l-12.5 25L0 75z"
      />
    </Pattern>
  );
}

function FlowersPattern() {
  return (
    <Pattern
      bgColor="#2b2b31"
      patternWidth={18}
      translateX={-4}
      translateY={7}
      viewBox="0 0 50 50"
    >
      <path
        fill="#ecc94b"
        d="M44.11 8.56c-.065.316-.192.615-.24.931-.037.395-.11.796-.083 1.197a6 6 0 0 0 .287 1.664c.166.405.303.835.577 1.187.225.358.456.724.788.994.222.222.483.42.614.718.4.748.164 1.758-.536 2.242-.663.515-1.69.47-2.285-.131-.414-.374-.525-.936-.717-1.433-.195-.513-.238-1.06-.316-1.599 0-.442-.015-.886.008-1.327.073-.471.115-.955.235-1.42.081-.295.195-.578.303-.864a6.2 6.2 0 0 1 .74-1.334c.176-.282.439-.515.61-.809zm-2.819.134L38.42 14.01a1.83 1.83 0 0 1-2.446.745c-.878-.452-1.197-1.569-.745-2.446a2 2 0 0 1 .745-.745zm.16-2.819a11 11 0 0 1-.771.638c-.49.34-1.008.652-1.581.832-.469.208-.978.308-1.484.387-.373.019-.736.106-1.112.084-.525.01-1.054-.003-1.566-.128-.563-.05-1.082-.293-1.612-.473-.832-.31-1.33-1.285-1.087-2.14.225-.892 1.211-1.49 2.107-1.28.45.09.836.38 1.111.738.274.272.54.558.89.73.347.243.713.455 1.117.586.428.163.87.291 1.329.322.578.108 1.18.056 1.755-.03.315-.026.605-.176.904-.266m3.377.612a1.33 1.33 0 0 1-1.33-1.33 1.33 1.33 0 0 1 1.33-1.33 1.33 1.33 0 0 1 1.33 1.33 1.33 1.33 0 0 1-1.33 1.33M41.439 44.11c-.315-.065-.614-.192-.93-.24-.395-.037-.796-.11-1.197-.083a6 6 0 0 0-1.664.287c-.405.166-.835.303-1.187.577-.358.225-.724.456-.994.788-.222.222-.42.483-.718.614-.748.4-1.758.164-2.242-.536-.515-.663-.47-1.69.131-2.285.374-.414.936-.525 1.433-.717.513-.195 1.06-.238 1.599-.316.442 0 .885-.015 1.326.008.472.073.956.115 1.421.235.295.081.578.195.864.303a6.2 6.2 0 0 1 1.334.74c.282.177.515.439.809.61zm-.133-2.819L35.99 38.42a1.83 1.83 0 0 1-.745-2.446c.452-.878 1.569-1.197 2.446-.745a2 2 0 0 1 .745.745zm2.819.16a11 11 0 0 1-.638-.771c-.34-.49-.652-1.008-.832-1.581-.208-.469-.308-.978-.387-1.484-.019-.373-.106-.736-.084-1.112-.01-.525.003-1.054.128-1.566.05-.563.293-1.082.473-1.612.31-.832 1.285-1.33 2.14-1.087.892.225 1.49 1.211 1.28 2.107-.09.45-.38.836-.738 1.111-.272.274-.558.54-.73.89-.243.347-.455.713-.586 1.117-.163.428-.291.87-.322 1.329-.108.578-.056 1.18.03 1.755.026.315.176.605.266.904m-.612 3.377a1.33 1.33 0 0 1 1.33-1.33 1.33 1.33 0 0 1 1.33 1.33 1.33 1.33 0 0 1-1.33 1.33 1.33 1.33 0 0 1-1.33-1.33M5.89 41.439c.065-.315.192-.614.24-.93.037-.395.11-.796.083-1.197a6 6 0 0 0-.287-1.664c-.166-.405-.303-.835-.577-1.187-.225-.358-.456-.724-.788-.994-.222-.222-.483-.42-.614-.718-.4-.748-.164-1.758.536-2.242.663-.515 1.69-.47 2.285.131.414.374.525.936.717 1.433.195.513.238 1.06.316 1.599 0 .442.015.885-.008 1.326-.073.472-.115.956-.235 1.421-.081.295-.195.578-.303.864a6.3 6.3 0 0 1-.74 1.334c-.176.282-.439.515-.61.809zm2.819-.133 2.871-5.317a1.83 1.83 0 0 1 2.446-.745c.878.452 1.197 1.569.745 2.446a2 2 0 0 1-.745.745zm-.16 2.819c.247-.226.507-.437.771-.638.49-.34 1.008-.652 1.581-.832.469-.208.978-.308 1.484-.387.373-.019.736-.106 1.112-.084.525-.01 1.054.003 1.566.128.563.05 1.082.293 1.612.473.832.31 1.33 1.285 1.087 2.14-.225.892-1.211 1.49-2.107 1.28-.45-.09-.836-.38-1.111-.738-.274-.272-.54-.559-.89-.73-.347-.243-.713-.455-1.117-.586-.428-.163-.87-.291-1.329-.322-.578-.108-1.18-.056-1.755.03-.315.026-.605.176-.904.266m-3.377-.612a1.33 1.33 0 0 1 1.33 1.33 1.33 1.33 0 0 1-1.33 1.33 1.33 1.33 0 0 1-1.33-1.33 1.33 1.33 0 0 1 1.33-1.33M8.561 5.89c.315.065.614.192.93.24.395.037.796.11 1.197.083a6 6 0 0 0 1.664-.288c.405-.165.835-.302 1.187-.576.358-.225.724-.456.994-.788.222-.222.42-.483.718-.614.748-.4 1.758-.164 2.242.536.515.663.47 1.69-.131 2.285-.374.414-.936.525-1.433.717-.513.195-1.06.238-1.599.316-.442 0-.885.015-1.326-.008-.472-.073-.956-.115-1.421-.235-.295-.081-.578-.195-.864-.303a6.3 6.3 0 0 1-1.334-.74c-.282-.177-.515-.439-.809-.61zm.133 2.819 5.317 2.871a1.83 1.83 0 0 1 .745 2.446c-.452.878-1.569 1.197-2.446.745a2 2 0 0 1-.745-.745zm-2.819-.16c.226.247.437.507.638.771.34.49.652 1.008.832 1.581.208.469.308.978.387 1.484.019.373.106.736.084 1.112.01.525-.003 1.054-.128 1.566-.05.563-.293 1.082-.473 1.612-.31.832-1.285 1.33-2.14 1.087-.892-.225-1.49-1.211-1.28-2.107.09-.45.38-.836.738-1.111.272-.274.558-.54.73-.89.243-.347.455-.713.586-1.117.163-.428.291-.87.322-1.329.108-.578.056-1.18-.03-1.755-.026-.315-.176-.605-.266-.904m.612-3.377a1.33 1.33 0 0 1-1.33 1.33 1.33 1.33 0 0 1-1.33-1.33 1.33 1.33 0 0 1 1.33-1.33 1.33 1.33 0 0 1 1.33 1.33m22.515 22.552c2.052-.142 2.476-1.875 2.476-2.724s-.46-2.582-2.476-2.724C26.951 22.135 24.97 25 24.97 25s2.016 2.83 4.032 2.724m-6.756 1.308c.142 2.052 1.875 2.476 2.724 2.476s2.582-.46 2.724-2.476C27.835 26.981 24.97 25 24.97 25s-2.83 2.016-2.724 4.032m-1.308-6.756c-2.052.142-2.476 1.875-2.476 2.724s.46 2.582 2.476 2.724C22.989 27.865 24.97 25 24.97 25s-2.016-2.83-4.032-2.724m6.756-1.308c-.142-2.052-1.875-2.476-2.724-2.476s-2.582.46-2.724 2.476C22.105 23.019 24.97 25 24.97 25s2.83-2.016 2.724-4.032"
      />
    </Pattern>
  );
}

function PixelHearts() {
  return (
    <Pattern bgColor="#2b2b31" translateX={1} viewBox="0 0 50 50">
      <path
        fill="#ecc94b"
        d="M29.688 0v1.562h3.125V0Zm-9.375 0h-3.125v1.562h3.125zm9.375 48.437V50h3.125v-1.563zm-12.5 0V50h3.125v-1.563zm12.5-3.125h-3.125v3.125h3.125zm-3.125-3.125h-3.125v3.125h3.125zm-6.25 3.125v3.125h3.125v-3.125zm28.125-12.5H50v-3.125h-1.562ZM50 20.312v-3.125h-1.562v3.125zm-4.687 9.375h3.125v-3.125h-3.125zm0-6.25h-3.125v3.125h3.125zm3.125 0v-3.125h-3.125v3.125zM0 29.687v3.125h1.563v-3.125zm1.563-12.5H0v3.125h1.563zm0 9.375v3.125h3.125v-3.125zm3.125-3.125v3.125h3.125v-3.125zm0-3.125H1.563v3.125h3.125Zm21.875-18.75v3.125h3.125V1.562Zm-3.125 3.125v3.125h3.125V4.687Zm0-3.125h-3.125v3.125h3.125z"
      />
      <path
        fill="#f44034"
        d="M14.063 18.75V25h3.125v3.125h3.125v3.125h3.125v3.125h3.125V31.25h3.125v-3.125h3.125V25h3.125v-6.25h-3.125v-3.125h-6.25v3.125h-3.125v-3.125h-6.25v3.125z"
      />
      <path
        fill="#00bdd6"
        d="M37.5 40.625h3.125V37.5H37.5Zm3.125 3.125h3.125v-3.125h-3.125zm3.125 3.125h3.125V43.75H43.75ZM50 50v-3.125h-3.125V50Zm-37.5-9.375V37.5H9.375v3.125zM9.375 43.75v-3.125H6.25v3.125ZM6.25 46.875V43.75H3.125v3.125zM3.125 50v-3.125H0V50Zm37.5-37.5V9.375H37.5V12.5Zm3.125-3.125V6.25h-3.125v3.125Zm3.125-3.125V3.125H43.75V6.25Zm0-3.125H50V0h-3.125ZM12.5 12.5V9.375H9.375V12.5ZM6.25 9.375h3.125V6.25H6.25ZM3.125 6.25H6.25V3.125H3.125ZM0 3.125h3.125V0H0Z"
      />
    </Pattern>
  );
}

const cardColors = {
  blue: "rgb(64,	106,	142)",
  red: "rgb(210,	66,	59)",
  green: "rgb(76,	140,	125)",
};
function SimplePattern({ pattern }: { pattern: "blue" | "red" | "green" }) {
  const id = useId();
  const color = cardColors[pattern];
  return (
    <Pattern bgColor={color} translateX={1} translateY={1}>
      <g opacity={0.8}>
        <line
          x1={0}
          y1={0}
          x2={10}
          y2={10}
          stroke={CARD_BG_COLOR}
          strokeWidth={0.2}
        />
        <line
          x1={0}
          y1={10}
          x2={10}
          y2={0}
          stroke={CARD_BG_COLOR}
          strokeWidth={0.2}
        />
        <circle cx={0} cy={0} r={0.8} fill={CARD_BG_COLOR} />
        <circle cx={10} cy={0} r={0.8} fill={CARD_BG_COLOR} />
        <circle cx={5} cy={5} r={0.8} fill={CARD_BG_COLOR} />
        <circle cx={0} cy={10} r={0.8} fill={CARD_BG_COLOR} />
        <circle cx={10} cy={10} r={0.8} fill={CARD_BG_COLOR} />
      </g>
    </Pattern>
  );
}

function Pattern({
  bgColor,
  patternWidth = 14,
  patternHeight,
  translateX = 0,
  translateY = 0,
  viewBox = "0 0 10 10",
  children,
}: {
  bgColor: string;
  patternWidth?: number;
  patternHeight?: number;
  translateX?: number;
  translateY?: number;
  viewBox?: string;
  children: ReactNode;
}) {
  const id = useId();
  const pHeight = patternHeight ?? patternWidth;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 140">
      <defs>
        <pattern
          id={id}
          width={patternWidth}
          height={pHeight}
          patternTransform={`translate(${translateX}, ${translateY})`}
          patternUnits="userSpaceOnUse"
          viewBox={viewBox}
        >
          {children}
        </pattern>
      </defs>
      <rect x="6" y="6" width="88" height="128" rx="3" fill={bgColor} />
      <rect
        x="7.5"
        y="7.5"
        width="85"
        height="125"
        rx="2"
        fill={`url(#${id})`}
        stroke={CARD_BG_COLOR}
        strokeWidth={0.8}
      />
    </svg>
  );
}
