/// <reference types="vite/client" />
import TitleBar from "@/components/TitleBar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/hooks/useUser";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import indexCss from "../index.css?url";
import {
  useVisibility,
  VisibilityProvider,
} from "@/contexts/VisibilityContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { DashedBorder } from "@/components/DashedBorder";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    links: [{ rel: "stylesheet", href: indexCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html>
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
  const { location } = useRouterState();
  const hideTitleBar =
    location.pathname.startsWith("/menu") ||
    location.pathname.startsWith("/capture-overlay");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <VisibilityProvider>
        <AppSettingsProvider>
          <UserProvider>
            {hideTitleBar ? (
              <div className="grid grid-rows-[auto_1fr] h-svh">
                <Outlet />
              </div>
            ) : (
              <TitleBar>
                <div className="grid grid-rows-[auto_1fr] h-svh bg-transparent!">
                  <Outlet />
                </div>
              </TitleBar>
            )}
            <Toaster position="top-right" />
          </UserProvider>
          {/*<TanStackRouterDevtools position="bottom-left" />*/}
        </AppSettingsProvider>
      </VisibilityProvider>
    </ThemeProvider>
  );
}
