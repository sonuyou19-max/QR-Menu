import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { FullPageSpinner } from "../components/FullPageSpinner";
import type { Tables } from "../lib/database.types";
import { supabase } from "../lib/supabase";

export type Restaurant = Tables<"restaurants">;

/** Owners can do everything; staff accounts only get Service mode (CLAUDE.md 4.5). */
export type Role = "owner" | "staff";

interface RestaurantState {
  restaurant: Restaurant;
  role: Role;
  reload: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantState | null>(null);
const ReloadContext = createContext<() => Promise<void>>(async () => {});

/**
 * Loads the owner's restaurant (RLS only returns restaurants they are a member of).
 * No restaurant yet → /setup; restaurant exists → /setup is skipped.
 */
export function RestaurantGate() {
  const location = useLocation();
  const [restaurant, setRestaurant] = useState<Restaurant | null | undefined>(
    undefined,
  );
  const [role, setRole] = useState<Role>("owner");
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) {
      setFailed(true);
      return;
    }
    if (data) {
      // Own membership only (RLS also returns the rest of the team).
      const { data: session } = await supabase.auth.getSession();
      const { data: member, error: memberError } = await supabase
        .from("restaurant_members")
        .select("role")
        .eq("restaurant_id", data.id)
        .eq("user_id", session.session?.user.id ?? "")
        .maybeSingle();
      if (memberError) {
        setFailed(true);
        return;
      }
      setRole(member?.role === "staff" ? "staff" : "owner");
    }
    setFailed(false);
    setRestaurant(data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (failed) return <FullPageSpinner error onRetry={() => void reload()} />;
  if (restaurant === undefined) return <FullPageSpinner />;
  const onSetup = location.pathname === "/setup";
  if (!restaurant && !onSetup) return <Navigate to="/setup" replace />;
  if (restaurant && onSetup) return <Navigate to="/" replace />;

  return (
    <ReloadContext.Provider value={reload}>
      {restaurant ? (
        <RestaurantContext.Provider value={{ restaurant, role, reload }}>
          <Outlet />
        </RestaurantContext.Provider>
      ) : (
        <Outlet />
      )}
    </ReloadContext.Provider>
  );
}

/** The owner's restaurant. Only use below RestaurantGate, outside /setup. */
export function useRestaurant(): RestaurantState {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant outside a loaded restaurant");
  return ctx;
}

/** Reload the restaurant after creating or changing it. */
export function useReloadRestaurant(): () => Promise<void> {
  return useContext(ReloadContext);
}

/** Owner-only pages: staff accounts are sent to Service mode. */
export function OwnerOnly() {
  const { role } = useRestaurant();
  return role === "staff" ? <Navigate to="/service" replace /> : <Outlet />;
}
