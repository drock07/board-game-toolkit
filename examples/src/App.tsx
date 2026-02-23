import { Link, Route, Routes } from "react-router";
import Home from "./pages/Home";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
          <Link to="/" className="text-lg font-semibold">
            Board Game Toolkit
          </Link>
          <span className="text-sm text-gray-500">Examples</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Routes>
          <Route index element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
