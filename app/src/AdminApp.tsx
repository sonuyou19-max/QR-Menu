// Must run before the Supabase client reads the address bar.
import "./lib/link-error";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { I18nProvider } from "./i18n";
import { AppLayout } from "./routes/AppLayout";
import { Login } from "./routes/Login";
import { MenuEditor } from "./routes/MenuEditor";
import { Overview } from "./routes/Overview";
import { RequireAuth } from "./routes/RequireAuth";
import { Service } from "./routes/Service";
import { Settings } from "./routes/Settings";
import { Setup } from "./routes/Setup";
import { Upload } from "./routes/Upload";
import { UploadResult } from "./routes/UploadResult";
import { OwnerOnly, RestaurantGate } from "./restaurant/RestaurantProvider";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RestaurantGate />,
        children: [
          { path: "/setup", element: <Setup /> },
          {
            element: <AppLayout />,
            children: [
              { path: "/service", element: <Service /> },
              {
                element: <OwnerOnly />,
                children: [
                  { index: true, element: <Overview /> },
                  { path: "/menu", element: <MenuEditor /> },
                  { path: "/settings", element: <Settings /> },
                  { path: "/upload", element: <Upload /> },
                  { path: "/upload/:id", element: <UploadResult /> },
                  {
                    path: "/look",
                    // Fonts and preview code load only on this screen.
                    lazy: async () => ({
                      Component: (await import("./routes/Look")).Look,
                    }),
                  },
                  {
                    path: "/qr",
                    // QR drawing code loads only on this screen.
                    lazy: async () => ({
                      Component: (await import("./routes/QrCodes")).QrCodes,
                    }),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

/** Owner and staff dashboard (login required). */
export function renderAdmin(root: Root) {
  root.render(
    <StrictMode>
      <I18nProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
