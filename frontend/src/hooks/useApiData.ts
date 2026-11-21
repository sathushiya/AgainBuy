import { useFocusEffect } from "@react-navigation/native";
import { DependencyList, useCallback, useRef, useState } from "react";
import { errorMessage } from "../services/api";

/**
 * Loads data from the API whenever the screen gains focus (so lists reflect
 * changes made on other screens) or `deps` change, and ignores responses that
 * arrive after a newer request started.
 */
export function useApiData<T>(load: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    try {
      const result = await load();
      if (request === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (caught) {
      if (request === latest.current) setError(errorMessage(caught));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, deps);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return { data, error, loading, reload, setData };
}
