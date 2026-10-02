import { createHashRouter, RouterProvider, useParams } from "react-router";
import { entryBySlug } from "./catalog";
import { EntryContext } from "./site/GameFrame";
import Home from "./site/Home";
import Layout from "./site/Layout";

function GameRoute() {
  const { slug = "" } = useParams();
  const entry = entryBySlug(slug);
  if (!entry) {
    return (
      <main className="p-16">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-muted">
          There&rsquo;s no example called {slug}.
        </p>
      </main>
    );
  }
  return (
    <EntryContext value={entry}>
      {/* A new key remounts the game, so each page starts fresh */}
      <entry.Page key={entry.slug} />
    </EntryContext>
  );
}

// Hash routing: the site is static, on GitHub Pages
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: ":slug", element: <GameRoute /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
