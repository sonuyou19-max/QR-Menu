import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { FullPageSpinner } from "../components/FullPageSpinner";

/** Owner-only pages: wait for the session, send logged-out visitors to /login. */
export function RequireAuth() {
  const { session } = useAuth();
  const location = useLocation();
  if (session === undefined) return <FullPageSpinner />;
  if (!session)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
