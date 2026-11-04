/**
 * Shared Clerk appearance for the auth pages (/auth/login, /auth/signup).
 * Every color is wired to the app's CSS variables so the sign-in / sign-up
 * card keeps readable contrast in both dark mode (the app default) and
 * light mode. Clerk's own defaults assume a white background, which made
 * input text and labels nearly invisible on the dark stat-card.
 *
 * The trailing "!" (Tailwind important modifier) matters: Clerk injects its
 * own internal stylesheet whose single-class rules can override plain
 * utility classes on the same element — without it the form labels render
 * in Clerk's near-black default and disappear on the dark card.
 */
export const clerkAppearance = {
  variables: {
    colorBackground: "var(--card)",
    colorText: "var(--foreground)",
    colorTextSecondary: "var(--muted-foreground)",
    colorInputText: "var(--foreground)",
    colorInputBackground: "var(--muted)",
    colorInputBorderColor: "var(--border)",
    colorInputPlaceholder: "var(--muted-foreground)",
    colorPrimary: "var(--foreground)",
    colorPrimaryText: "var(--background)",
    colorDanger: "var(--destructive)",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full! max-w-full! min-w-0!",
    cardBox: "w-full! max-w-full! min-w-0! shadow-none!",
    card: "w-full! max-w-full! min-w-0! bg-transparent! border-0! shadow-none! px-0! sm:px-0!",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground!",
    formButtonPrimary: "bg-foreground text-background font-semibold hover:opacity-90",
    formFieldLabel: "text-foreground!",
    formFieldInput: "w-full! min-w-0! min-h-11! text-base! bg-muted! border-border! text-foreground! placeholder:text-muted-foreground!",
    socialButtonsBlockButton: "w-full! min-h-11! border border-border! text-foreground! bg-secondary!",
    socialButtonsBlockButtonText: "text-foreground",
    footerActionText: "text-muted-foreground!",
    footerActionLink: "text-foreground underline",
    alternativeMethodsBlockButtonArrow: "text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground!",
    footer: "bg-transparent!",
    logoBox: "hidden!",
  },
} as const;
