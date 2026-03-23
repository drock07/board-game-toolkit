import clsx from "clsx";
import {
  CardBack,
  CardDimensionsContext,
  CardGrid,
  CardHand,
  CardPool,
  CardShape,
  CardStack,
  StandardPlayingCard,
  useCardDimensionsContext,
  useStateMachineActions,
  useStateMachineState,
  withStateMachineContext,
} from "@drock07/board-game-toolkit-react";
import { useState, type ReactNode } from "react";
import PageLayout, { GlassButton } from "../../../components/PageLayout";
import type { DemoCard, DemoCommand, DemoState } from "./config";
import { config, initialState } from "./config";

// --- Static card data for standalone section demos ---

const DEMO_CARDS: DemoCard[] = [
  { id: "hearts-A", suit: "hearts", rank: "A" },
  { id: "spades-K", suit: "spades", rank: "K" },
  { id: "diamonds-Q", suit: "diamonds", rank: "Q" },
  { id: "clubs-J", suit: "clubs", rank: "J" },
  { id: "hearts-10", suit: "hearts", rank: "10" },
  { id: "spades-9", suit: "spades", rank: "9" },
  { id: "diamonds-8", suit: "diamonds", rank: "8" },
  { id: "clubs-7", suit: "clubs", rank: "7" },
  { id: "hearts-6", suit: "hearts", rank: "6" },
];

// ============================================================
// Shared layout components
// ============================================================

function CodeBlock({
  code,
  language = "tsx",
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <div className="border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-white/30">{language}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-white/75">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-6">
      {children}
    </div>
  );
}

function DocSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-white/10 pt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EmptySlot() {
  const { width } = useCardDimensionsContext();
  return (
    <CardShape
      cardWidth={width}
      style={{
        border: "2px dashed rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.04)",
      }}
    />
  );
}

// ============================================================
// Section: GenericCardGameState
// ============================================================

const STATE_TYPE_CODE = `interface GenericCardGameState<
  TPoolId extends string = string,
  TCard extends GenericCardInstance = GenericCardInstance,
> {
  pools: { [K in TPoolId]: TCard[] };
}`;

const STATE_EXAMPLE_CODE = `type PoolId = "deck" | "hand" | "discard";

interface MyCard extends GenericCardInstance {
  suit: PlayingCardSuit;
  rank: PlayingCardRank;
}

interface MyState extends GenericCardGameState<PoolId, MyCard> {
  score: number;
}`;

const STATE_SNAPSHOT_CODE = `// Example MyState value at runtime
{
  pools: {
    deck: [ /* 51 cards */ ],
    hand: [
      { id: "hearts-A", suit: "hearts", rank: "A" },
      { id: "spades-K", suit: "spades", rank: "K" },
    ],
    discard: [],
  },
  score: 21,
}`;

function StateTypeSection() {
  return (
    <DocSection
      title="GenericCardGameState"
      description="The base state type for card games. It defines a pools property — a typed record of named card arrays. Extend it to add your own pool IDs, card type, and any additional game state."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <CodeBlock code={STATE_TYPE_CODE} language="ts" />
          <CodeBlock code={STATE_EXAMPLE_CODE} language="ts" />
        </div>
        <CodeBlock code={STATE_SNAPSHOT_CODE} language="ts" />
      </div>
    </DocSection>
  );
}

// ============================================================
// Section: CardPool
// ============================================================

const CARD_POOL_CODE = `// Reads from the nearest StateMachineContext.
// poolId is constrained to valid keys of MyState["pools"].

<CardPool<MyState> poolId="hand">
  {(cards) => (
    <CardHand>
      {cards.map((card) => (
        <StandardPlayingCard key={card.id} card={card} />
      ))}
    </CardHand>
  )}
</CardPool>`;

function CardPoolDemoInner() {
  const state = useStateMachineState<DemoState>();
  const { dispatch, canDispatch } = useStateMachineActions<
    DemoState,
    DemoCommand
  >();

  return (
    <CardDimensionsContext width={55}>
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          {/* Deck */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-white/40">
              deck ({state.pools.deck.length})
            </span>
            <CardPool<DemoState> poolId="deck">
              {(cards) =>
                cards.length > 0 ? (
                  <CardStack stagger={2}>
                    {cards.slice(-4).map((c) => (
                      <CardBack key={c.id} />
                    ))}
                  </CardStack>
                ) : (
                  <EmptySlot />
                )
              }
            </CardPool>
          </div>

          {/* Hand */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="text-xs text-white/40">
              hand ({state.pools.hand.length})
            </span>
            <CardPool<DemoState> poolId="hand">
              {(cards) =>
                cards.length === 0 ? (
                  <span className="py-6 text-xs text-white/25">empty</span>
                ) : (
                  <CardHand>
                    {cards.map((c) => (
                      <StandardPlayingCard key={c.id} card={c} />
                    ))}
                  </CardHand>
                )
              }
            </CardPool>
          </div>

          {/* Discard */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-white/40">
              discard ({state.pools.discard.length})
            </span>
            <CardPool<DemoState> poolId="discard">
              {(cards) =>
                cards.length > 0 ? (
                  <CardStack>
                    <StandardPlayingCard card={cards[cards.length - 1]} />
                  </CardStack>
                ) : (
                  <EmptySlot />
                )
              }
            </CardPool>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <GlassButton
            onClick={() => dispatch({ type: "draw" })}
            disabled={!canDispatch({ type: "draw" })}
          >
            Draw
          </GlassButton>
          <GlassButton
            onClick={() => {
              const top = state.pools.hand[0];
              if (top) dispatch({ type: "discard", cardId: top.id });
            }}
            disabled={state.pools.hand.length === 0}
          >
            Discard
          </GlassButton>
          <GlassButton
            onClick={() => dispatch({ type: "shuffleBack" })}
            disabled={!canDispatch({ type: "shuffleBack" })}
          >
            Shuffle Back
          </GlassButton>
        </div>
      </div>
    </CardDimensionsContext>
  );
}

const CardPoolDemo = withStateMachineContext(
  CardPoolDemoInner,
  config,
  initialState,
  { autostart: true },
);

function CardPoolSection() {
  return (
    <DocSection
      title="CardPool"
      description="Reads a named pool from the nearest StateMachineContext and passes the cards to a render prop. Re-renders automatically when the pool changes. The type parameter constrains poolId to valid keys of your state's pools."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={CARD_POOL_CODE} language="tsx" />
        <DemoFrame>
          <CardPoolDemo />
        </DemoFrame>
      </div>
    </DocSection>
  );
}

// ============================================================
// Section: CardStack
// ============================================================

const CARD_STACK_CODE = `// Default: CSS shadow suggests depth, top card visible
<CardStack>
  {cards.map((c) => <CardBack key={c.id} />)}
</CardStack>

// Scattered pile: random rotations and offsets per card.
// Top card stays straight. Try values around 6–12.
<CardStack stagger={8}>
  {cards.map((c) => <CardBack key={c.id} />)}
</CardStack>`;

function CardStackSection() {
  const [count, setCount] = useState(5);
  const ids = Array.from({ length: count }, (_, i) => `card-${i}`);

  return (
    <DocSection
      title="CardStack"
      description="Renders cards stacked on top of each other. The last child is the top card. Without stagger, a CSS box-shadow hints at depth. With stagger, each non-top card gets a small random rotation and offset — like cards tossed onto a pile."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={CARD_STACK_CODE} language="tsx" />
        <DemoFrame>
          <CardDimensionsContext width={65}>
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/40">Cards:</span>
                {[1, 3, 5, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={clsx(
                      "rounded border px-2 py-1 text-xs transition",
                      count === n
                        ? "border-white/60 text-white"
                        : "border-white/20 text-white/40 hover:text-white/60",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-12">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs text-white/40">Default</span>
                  <CardStack>
                    {ids.map((id) => (
                      <CardBack key={id} />
                    ))}
                  </CardStack>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs text-white/40">stagger=8</span>
                  <CardStack stagger={8}>
                    {ids.map((id) => (
                      <CardBack key={id} />
                    ))}
                  </CardStack>
                </div>
              </div>
            </div>
          </CardDimensionsContext>
        </DemoFrame>
      </div>
    </DocSection>
  );
}

// ============================================================
// Section: CardHand
// ============================================================

const CARD_HAND_CODE = `const [selected, setSelected] = useState<string | null>(null);

<CardHand
  selectedKey={selected}
  onCardClick={setSelected}
  arc={0.3}
>
  {cards.map((card) => (
    <StandardPlayingCard key={card.id} card={card} />
  ))}
</CardHand>`;

function CardHandSection() {
  const [hand, setHand] = useState(DEMO_CARDS.slice(0, 5));
  const [selected, setSelected] = useState<string | null>(null);

  const handleDeal = () => {
    const next = DEMO_CARDS.find((c) => !hand.some((h) => h.id === c.id));
    if (next) setHand((prev) => [...prev, next]);
  };

  const handleRemove = () => {
    if (!selected) return;
    setHand((prev) => prev.filter((c) => c.id !== selected));
    setSelected(null);
  };

  return (
    <DocSection
      title="CardHand"
      description="Arranges cards horizontally with an optional arc, compressing them to fit the container width. Handles hover, focus, keyboard navigation (arrow keys), and controlled selection out of the box."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={CARD_HAND_CODE} language="tsx" />
        <DemoFrame>
          <CardDimensionsContext width={70}>
            <div className="flex w-full flex-col gap-4">
              <CardHand
                selectedKey={selected}
                onCardClick={setSelected}
                arc={0.3}
              >
                {hand.map((card) => (
                  <StandardPlayingCard key={card.id} card={card} />
                ))}
              </CardHand>
              <div className="mt-2 flex justify-center gap-2">
                <GlassButton
                  onClick={handleDeal}
                  disabled={hand.length >= DEMO_CARDS.length}
                >
                  Deal
                </GlassButton>
                <GlassButton onClick={handleRemove} disabled={!selected}>
                  Remove selected
                </GlassButton>
              </div>
            </div>
          </CardDimensionsContext>
        </DemoFrame>
      </div>
    </DocSection>
  );
}

// ============================================================
// Section: CardGrid
// ============================================================

const CARD_GRID_DENSE_CODE = `// Auto-fill columns based on card width from context
<CardGrid>
  {cards.map((card) => (
    <StandardPlayingCard key={card.id} card={card} />
  ))}
</CardGrid>

// Fixed column count
<CardGrid columns={3}>
  {cards.map((card) => (
    <StandardPlayingCard key={card.id} card={card} />
  ))}
</CardGrid>`;

const CARD_GRID_SPARSE_CODE = `// rows and columns required in sparse mode.
// Render function is called for every slot — return
// a card node or null/undefined for an empty slot.
<CardGrid rows={4} columns={4}>
  {(x, y) => {
    const card = placed.find((c) => c.x === x && c.y === y);
    return card
      ? <MyCard card={card} onClick={() => remove(x, y)} />
      : <EmptySlot onClick={() => place(x, y)} />;
  }}
</CardGrid>`;

const COLUMN_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: "auto" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
];

const INITIAL_SPARSE: ReadonlySet<string> = new Set([
  "0,0", "1,0", "3,1", "2,2", "0,2", "1,3", "3,3",
]);

function CardGridSection() {
  const [columns, setColumns] = useState<number | undefined>(undefined);
  const [filled, setFilled] = useState<Set<string>>(() => new Set(INITIAL_SPARSE));

  const toggleSlot = (x: number, y: number) => {
    const key = `${x},${y}`;
    setFilled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <DocSection
      title="CardGrid"
      description="Arranges cards in a CSS grid with two modes: dense fills slots in order from children, sparse calls a render function with (x, y) coordinates for each slot."
    >
      {/* Dense */}
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/50">
        Dense
      </h3>
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={CARD_GRID_DENSE_CODE} language="tsx" />
        <DemoFrame>
          <CardDimensionsContext width={60}>
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Columns:</span>
                {COLUMN_OPTIONS.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setColumns(value)}
                    className={clsx(
                      "rounded border px-2 py-1 text-xs transition",
                      columns === value
                        ? "border-white/60 text-white"
                        : "border-white/20 text-white/40 hover:text-white/60",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <CardGrid columns={columns}>
                {DEMO_CARDS.map((card) => (
                  <StandardPlayingCard key={card.id} card={card} />
                ))}
              </CardGrid>
            </div>
          </CardDimensionsContext>
        </DemoFrame>
      </div>

      {/* Sparse */}
      <h3 className="mb-4 mt-8 text-sm font-semibold uppercase tracking-wide text-white/50">
        Sparse
      </h3>
      <div className="grid gap-6 lg:grid-cols-2">
        <CodeBlock code={CARD_GRID_SPARSE_CODE} language="tsx" />
        <DemoFrame>
          <CardDimensionsContext width={55}>
            <div className="flex w-full flex-col gap-4">
              <CardGrid rows={4} columns={4}>
                {(x, y) => {
                  const key = `${x},${y}`;
                  return filled.has(key) ? (
                    <div
                      className="cursor-pointer transition-opacity hover:opacity-75"
                      onClick={() => toggleSlot(x, y)}
                    >
                      <CardBack />
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer transition-opacity hover:opacity-60"
                      onClick={() => toggleSlot(x, y)}
                    >
                      <EmptySlot />
                    </div>
                  );
                }}
              </CardGrid>
              <p className="text-center text-xs text-white/30">
                Click to place or remove cards
              </p>
            </div>
          </CardDimensionsContext>
        </DemoFrame>
      </div>
    </DocSection>
  );
}

// ============================================================
// Page
// ============================================================

export default function GenericCardGame() {
  return (
    <PageLayout title="Card Pools">
      <div className="size-full overflow-auto">
        <PageLayout.SafeInset />
        <div className="mx-auto mt-4 max-w-4xl px-6 pb-16 text-white">
          <h1 className="text-2xl font-bold">Card Pools</h1>
          <p className="mt-2 text-sm text-white/60">
            Board Game Toolkit models card games around named pools — typed,
            ordered arrays of cards stored in your game state. The components
            below connect those pools to UI, handling layout and context
            reactivity automatically.
          </p>
          <StateTypeSection />
          <CardPoolSection />
          <CardStackSection />
          <CardHandSection />
          <CardGridSection />
        </div>
      </div>
    </PageLayout>
  );
}
