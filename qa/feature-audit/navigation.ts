import { qaHref } from "./link";
export function useRouter() { return { push: (href: string) => { location.href = qaHref(href); } }; }
