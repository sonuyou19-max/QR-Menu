import { useCallback, useEffect, useState } from "react";
import type { Tables } from "../lib/database.types";
import { supabase } from "../lib/supabase";

export type Translation = Pick<
  Tables<"translations">,
  | "entity_id"
  | "language"
  | "source_hash"
  | "name"
  | "menu_description"
  | "typical_description"
>;

/**
 * The restaurant's translations. A dish or category counts as translated into a language when
 * that row exists and was made from its current text (source_hash = content_hash).
 */
export function useTranslations(restaurantId: string) {
  const [rows, setRows] = useState<Translation[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("translations")
      .select(
        "entity_id, language, source_hash, name, menu_description, typical_description",
      )
      .eq("restaurant_id", restaurantId);
    if (data) setRows(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Languages in which this text has no up-to-date translation. */
  const missingLanguages = useCallback(
    (entityId: string, hash: string | null, languages: string[]) =>
      languages.filter(
        (language) =>
          !rows.some(
            (r) =>
              r.entity_id === entityId &&
              r.language === language &&
              r.source_hash === hash,
          ),
      ),
    [rows],
  );

  return { rows, reload, missingLanguages };
}
