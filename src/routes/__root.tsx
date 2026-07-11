import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

import { auth } from "../lib/auth";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const pathname = location.pathname;

    // Allow access to login and suspended pages without auth
    if (pathname === "/login" || pathname === "/suspended") {
      return;
    }

    const session = await auth.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    const profile = await auth.getUserProfile();
    if (!profile) {
      throw redirect({
        to: "/login",
      });
    }

    // Check if the tenant/shop status is active
    const isTenantInactive = profile.tenant_status === "suspended" || 
                             profile.tenant_status === "inactive" || 
                             profile.tenant_status === "pending";

    if (isTenantInactive) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pos.suspended", "true");
      }
      throw redirect({
        to: "/suspended",
      });
    } else {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("pos.suspended");
      }
    }

    // If super_admin, force redirection to /admin (unless already there)
    if (profile.role === "super_admin" && pathname !== "/admin") {
      throw redirect({
        to: "/admin",
      });
    }

    // Standard user should not access the /admin panel
    if (profile.role !== "super_admin" && pathname === "/admin") {
      throw redirect({
        to: "/",
      });
    }

    return {
      profile,
    };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "POS – General Point of Sale" },
      { name: "description", content: "Simple general-purpose POS for any shop." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "POS – General Point of Sale" },
      { property: "og:description", content: "Simple general-purpose POS for any shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "POS – General Point of Sale" },
      { name: "twitter:description", content: "Simple general-purpose POS for any shop." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/LActwpR8i3d7khKYEZ3rCmcn3192/social-images/social-1783437635546-MEITU_20260604_151710748.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/LActwpR8i3d7khKYEZ3rCmcn3192/social-images/social-1783437635546-MEITU_20260604_151710748.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/logo.png?v=2", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png?v=2" },
      { rel: "icon", href: "/favicon.ico?v=2", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
