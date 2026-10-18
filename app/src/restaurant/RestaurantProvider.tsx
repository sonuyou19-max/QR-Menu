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

interface RestaurantState {
  restaurant: Restaurant;
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
        <RestaurantContext.Provider value={{ restaurant, reload }}>
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
