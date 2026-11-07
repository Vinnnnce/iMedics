import { qaHref } from "./link";
export function useRouter() { return { push: (href: string) => { location.href = qaHref(href); } }; }
export function usePathname() { return new URLSearchParams(location.search).get("screen") === "master-control" ? "/admin/control" : "/lab/organization"; }
