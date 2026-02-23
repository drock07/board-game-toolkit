import type { ReactNode } from "react";
import { Link } from "react-router";

interface PageLayoutProps {
  title?: string;
  tools?: ReactNode;
  children: ReactNode;
}

export default function PageLayout({
  title,
  tools,
  children,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          {title && (
            <Link
              to="/"
              className="text-gray-400 hover:text-gray-600"
              aria-label="Back to examples"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-5"
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          )}

          <Link to="/" className="text-lg font-semibold">
            Board Game Toolkit
          </Link>

          {title && (
            <span className="text-sm font-medium text-gray-700">{title}</span>
          )}

          {tools && <div className="ml-auto">{tools}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
