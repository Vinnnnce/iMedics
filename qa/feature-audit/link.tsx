import type { AnchorHTMLAttributes } from "react";
/** Isolated QA only. Production uses Next.js Link unchanged. */
export function qaHref(href: string) {
  if (href === "/emergency") return "/?screen=emergency";
  if (href.startsWith("/emergency/")) return `/?screen=module&id=${encodeURIComponent(href.slice(11))}`;
  return href;
}
export default function QALink(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} href={qaHref(props.href ?? "")} />; }
