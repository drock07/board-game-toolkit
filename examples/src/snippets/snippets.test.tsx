import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Board } from "./MinimalBoard";

test("the minimal board renders a button per cell", () => {
  const html = renderToStaticMarkup(<Board />);
  expect(html.match(/<button/g)).toHaveLength(9);
});
