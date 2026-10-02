/** A site path under the deploy base: `href("examples/blackjack/")`. */
export const href = (path: string) =>
  import.meta.env.BASE_URL.replace(/\/?$/, "/") + path.replace(/^\//, "");
