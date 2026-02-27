import { createContext, ReactNode, useContext, useMemo } from "react";

export const DEFAULT_CARD_WIDTH = 64;
export const DEFAULT_ASPECT_RATIO = 5 / 7;

export interface CardDimensionsContextValue {
  width: number;
  aspectRatio: number;
}

const Context = createContext<CardDimensionsContextValue>({
  width: DEFAULT_CARD_WIDTH,
  aspectRatio: DEFAULT_ASPECT_RATIO,
});

export interface CardDimensionsContextProps {
  width?: number;
  aspectRatio?: number;
  children?: ReactNode;
}

export function CardDimensionsContext({
  width,
  aspectRatio,
  children,
}: CardDimensionsContextProps) {
  const value = useMemo(
    () => ({
      width: width ?? DEFAULT_CARD_WIDTH,
      aspectRatio: aspectRatio ?? DEFAULT_ASPECT_RATIO,
    }),
    [width, aspectRatio],
  );
  return <Context value={value}>{children}</Context>;
}

export function useCardDimensionsContext() {
  return useContext(Context);
}
