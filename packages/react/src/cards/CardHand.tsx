import React, {
  type HTMLAttributes,
  type Ref,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useCardDimensionsContext } from "./CardDimensionsContext";

function getItemKey(child: ReactNode, index: number): string {
  if (React.isValidElement(child) && child.key != null) {
    return String(child.key);
  }
  return String(index);
}

export type CardWrapperProps = HTMLAttributes<HTMLDivElement> & {
  ref?: Ref<HTMLDivElement>;
};

export interface CardHandProps {
  children: ReactNode;
  cardWidth?: number;
  cardAspectRatio?: number;
  selectedKey?: string | null;
  onCardClick?: (key: string) => void;
  getCardProps?: (key: string) => CardWrapperProps | undefined;
  arc?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const ARC_MAX_ROTATION = 15;
const ARC_MAX_OFFSET_Y = 20;

export function CardHand({
  children,
  cardWidth,
  cardAspectRatio,
  selectedKey = null,
  onCardClick,
  getCardProps,
  arc = 0,
  className,
  style,
  "aria-label": ariaLabel = "Card hand",
}: CardHandProps) {
  const { width: contextCardWidth, aspectRatio: contextAspectRatio } =
    useCardDimensionsContext();
  const resolvedCardWidth = cardWidth ?? contextCardWidth;
  const resolvedAspectRatio = cardAspectRatio ?? contextAspectRatio;
  const cardHeight = resolvedCardWidth / resolvedAspectRatio;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const items = React.Children.toArray(children);
  const count = items.length;

  // Keep focusedIndex in bounds when children change
  useEffect(() => {
    if (count > 0 && focusedIndex >= count) {
      setFocusedIndex(count - 1);
    }
  }, [count, focusedIndex]);

  // Calculate the offset between each card's left edge.
  // If cards fit side-by-side, use full card width. Otherwise, compress evenly.
  const maxOffset =
    count > 1 ? (containerWidth - resolvedCardWidth) / (count - 1) : 0;
  const offset = Math.min(resolvedCardWidth * 0.75, maxOffset);

  // Total width the cards actually occupy
  const totalWidth = count > 0 ? offset * (count - 1) + resolvedCardWidth : 0;
  // Center the cards within the container
  const startX = (containerWidth - totalWidth) / 2;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (count === 0) return;

    switch (e.key) {
      case "ArrowLeft": {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < count - 1 ? prev + 1 : prev));
        break;
      }
      case "Home": {
        e.preventDefault();
        setFocusedIndex(0);
        break;
      }
      case "End": {
        e.preventDefault();
        setFocusedIndex(count - 1);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (onCardClick) {
          const key = getItemKey(items[focusedIndex], focusedIndex);
          onCardClick(key);
        }
        break;
      }
    }
  };

  return (
    <div ref={containerRef} className={className ?? "w-full"} style={style}>
      <div
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={
          count > 0
            ? `card-hand-item-${getItemKey(items[focusedIndex], focusedIndex)}`
            : undefined
        }
        tabIndex={count > 0 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        className="relative outline-none"
        style={{ height: count > 0 ? cardHeight : 0 }}
      >
        {items.map((child, i) => {
          const key = getItemKey(child, i);
          const isFocused = focusedIndex === i;
          const isHovered = hoveredIndex === i;
          const isSelected = selectedKey === key;
          const isRaised = isHovered || isSelected || isFocused;

          // Normalized position: -1 (left) to 1 (right)
          const t = count > 1 ? (2 * i) / (count - 1) - 1 : 0;
          const rotation = arc * ARC_MAX_ROTATION * t;
          const arcOffsetY = arc * ARC_MAX_OFFSET_Y * t * t;

          let transform: string;
          if (isRaised) {
            transform = "scale(1.1) translateY(-8px)";
          } else if (arc > 0) {
            transform = `translateY(${arcOffsetY}px) rotate(${rotation}deg)`;
          } else {
            transform = "scale(1)";
          }

          const cardStyle: CSSProperties = {
            position: "absolute",
            left: startX + i * offset,
            zIndex: isRaised ? count + 1 : i,
            transform,
            transformOrigin: "bottom center",
            transition: "transform 150ms ease-out, left 200ms ease-out",
            cursor: onCardClick ? "pointer" : undefined,
          };

          const handleClick = onCardClick ? () => onCardClick(key) : undefined;

          const userProps = getCardProps?.(key);
          const {
            ref: userRef,
            style: userStyle,
            ...restUserProps
          } = userProps ?? {};

          // Prepend user transform (e.g. drag offset) to layout transform
          const composedTransform = userStyle?.transform
            ? `${userStyle.transform} ${transform}`
            : transform;

          const mergedStyle: CSSProperties = {
            ...cardStyle,
            ...userStyle,
            transform: composedTransform,
            // User transition merges with ours if provided
            transition: userStyle?.transition
              ? `${cardStyle.transition}, ${userStyle.transition}`
              : cardStyle.transition,
          };

          return (
            <div
              key={key}
              ref={userRef}
              id={`card-hand-item-${key}`}
              role="option"
              aria-selected={isSelected}
              {...restUserProps}
              style={mergedStyle}
              onPointerEnter={() => setHoveredIndex(i)}
              onPointerLeave={() => setHoveredIndex(null)}
              onClick={handleClick}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface UncontrolledCardHandProps {
  children: ReactNode;
  cardWidth?: number;
  cardAspectRatio?: number;
  onSelect?: (key: string | null) => void;
  getCardProps?: (key: string) => CardWrapperProps | undefined;
  arc?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function UncontrolledCardHand({
  onSelect,
  children,
  ...props
}: UncontrolledCardHandProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const items = React.Children.toArray(children);
  const currentKeysStr = items
    .map((child, i) => getItemKey(child, i))
    .join("\0");

  useEffect(() => {
    if (selectedKey !== null) {
      const currentKeys = new Set(currentKeysStr.split("\0"));
      if (!currentKeys.has(selectedKey)) {
        setSelectedKey(null);
        onSelect?.(null);
      }
    }
  }, [selectedKey, currentKeysStr, onSelect]);

  const handleCardClick = (key: string) => {
    const newKey = key === selectedKey ? null : key;
    setSelectedKey(newKey);
    onSelect?.(newKey);
  };

  return (
    <CardHand
      {...props}
      selectedKey={selectedKey}
      onCardClick={handleCardClick}
    >
      {children}
    </CardHand>
  );
}
