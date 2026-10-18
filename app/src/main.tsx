// Must run before the Supabase client reads the address bar.
import "./lib/link-error";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import "./styles.css";
import { AuthProvider } from "./auth/AuthProvider";
import { I18nProvider } from "./i18n";
import { AppLayout } from "./routes/AppLayout";
import { Login } from "./routes/Login";
import { Overview } from "./routes/Overview";
import { RequireAuth } from "./routes/RequireAuth";
import { Setup } from "./routes/Setup";
import { Upload } from "./routes/Upload";
import { UploadResult } from "./routes/UploadResult";
import { RestaurantGate } from "./restaurant/RestaurantProvider";

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
              { index: true, element: <Overview /> },
              { path: "/upload", element: <Upload /> },
              { path: "/upload/:id", element: <UploadResult /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
