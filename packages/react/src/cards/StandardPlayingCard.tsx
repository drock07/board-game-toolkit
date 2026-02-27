import {
  isPlayingCardRedSuit,
  PlayingCard,
  PlayingCardRank,
  playingCardSuitSymbol,
} from "@drock07/board-game-toolkit-core";
import { useCardDimensionsContext } from "./CardDimensionsContext";
import { CardShape, CardShapeProps } from "./CardShape";

export interface StandardPlayingCardProps {
  card: PlayingCard;
}

export function StandardPlayingCard({
  card,
  style,
  cardWidth: customWidth,
  ...props
}: StandardPlayingCardProps &
  Omit<CardShapeProps, "children" | "aspectRatio">) {
  const { width: inheritedWidth } = useCardDimensionsContext();
  const width = customWidth ?? inheritedWidth;
  const { suit } = card;
  const isRed = isPlayingCardRedSuit(suit);
  return (
    <CardShape
      {...props}
      cardWidth={width}
      aspectRatio={5 / 7}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        color: isRed ? "red" : "black",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: "2%",
        }}
      >
        <CardLabel cardWidth={width} card={card} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "2%",
          rotate: "180deg",
        }}
      >
        <CardLabel cardWidth={width} card={card} />
      </div>
      <CardDesign cardWidth={width} card={card} />
    </CardShape>
  );
}

function CardLabel({
  cardWidth,
  card,
}: {
  cardWidth: number;
  card: PlayingCard;
}) {
  const { rank, suit } = card;
  const symbol = playingCardSuitSymbol(suit);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        lineHeight: 1,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontWeight: "bold",
          fontSize: cardWidth * 0.13,
        }}
      >
        {rank}
      </span>
      <span
        style={{
          fontSize: cardWidth * 0.1,
        }}
      >
        {symbol}
      </span>
    </div>
  );
}

type Pip = [0 | 1 | 2, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];

const COL_X = [28, 50, 72];
const ROW_Y = [15, 27, 32, 38, 50, 63, 69, 75, 85];
const PIP_LAYOUTS: Record<Exclude<PlayingCardRank, "J" | "Q" | "K">, Pip[]> = {
  A: [[1, 4]],
  "2": [
    [1, 0],
    [1, 8],
  ],
  "3": [
    [1, 0],
    [1, 4],
    [1, 8],
  ],
  "4": [
    [0, 0],
    [0, 8],
    [2, 0],
    [2, 8],
  ],
  "5": [
    [0, 0],
    [0, 8],
    [1, 4],
    [2, 0],
    [2, 8],
  ],
  "6": [
    [0, 0],
    [0, 4],
    [0, 8],
    [2, 0],
    [2, 4],
    [2, 8],
  ],
  "7": [
    [0, 0],
    [0, 4],
    [0, 8],
    [1, 2],
    [2, 0],
    [2, 4],
    [2, 8],
  ],
  "8": [
    [0, 0],
    [0, 4],
    [0, 8],
    [1, 2],
    [1, 6],
    [2, 0],
    [2, 4],
    [2, 8],
  ],
  "9": [
    [0, 0],
    [0, 3],
    [0, 5],
    [0, 8],
    [1, 4],
    [2, 0],
    [2, 3],
    [2, 5],
    [2, 8],
  ],
  "10": [
    [0, 0],
    [0, 3],
    [0, 5],
    [0, 8],
    [1, 1],
    [1, 7],
    [2, 0],
    [2, 3],
    [2, 5],
    [2, 8],
  ],
};

function CardDesign({
  cardWidth,
  card,
}: {
  cardWidth: number;
  card: PlayingCard;
}) {
  const { rank, suit } = card;
  const symbol = playingCardSuitSymbol(suit);

  if (rank === "J" || rank === "Q" || rank === "K")
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: cardWidth * 0.8,
          fontWeight: "bold",
          lineHeight: 1,
        }}
      >
        {rank}
      </div>
    );

  return (
    <>
      {PIP_LAYOUTS[rank].map(([col, row], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${ROW_Y[row]}%`,
            left: `${COL_X[col]}%`,
            transform: `translate(-50%, -50%)${(row === 4 ? col === 2 : row > 4) ? " rotate(180deg)" : ""}`,
            fontSize: rank === "A" ? cardWidth * 0.8 : cardWidth * 0.25,
            lineHeight: 1,
          }}
        >
          {symbol}
        </div>
      ))}
    </>
  );
}
