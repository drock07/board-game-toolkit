import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Table } from "./AnimatedTable";
import { Board } from "./MinimalBoard";

test("the minimal board renders a button per cell", () => {
  const html = renderToStaticMarkup(<Board />);
  expect(html.match(/<button/g)).toHaveLength(9);
});

test("the animated table renders its actions", () => {
  const html = renderToStaticMarkup(<Table />);
  expect(html).toContain("Your HP: ");
  expect(html).toContain("<button");
});
