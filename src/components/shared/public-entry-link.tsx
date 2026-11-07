"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { isPublicPageHref } from "@/lib/public-navigation";

/** Anonymous entry links must not prefetch protected RSC responses. Clerk's
 * external sign-in redirect requires a top-level navigation, not an RSC fetch. */
export function PublicEntryLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        event.currentTarget.hasAttribute("download") || (props.target && props.target !== "_self") ||
        event.currentTarget.origin !== window.location.origin ||
        isPublicPageHref(event.currentTarget.pathname)) return;
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  };
  return <Link {...props} prefetch={false} onClick={click} />;
}
