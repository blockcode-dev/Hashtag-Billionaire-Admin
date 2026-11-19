/** @format */

import { useEffect, useState } from "react";

// Loads `fetcher` whenever `key` changes. While the next answer loads, the last one stays
// (`stale` is true), so cards keep their shape instead of flashing a skeleton.
export function useApi<T>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: unknown }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    fetcher().then(
      (data) => {
        if (active) setState({ key, data, error: null });
      },
      (error) => {
        if (active) setState((s) => ({ key, data: s.data, error }));
      },
    );
    return () => {
      active = false;
    };
    // The key names everything the fetcher depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    // Nothing yet: show a placeholder.
    loading: state.data === null && !(settled && state.error),
    // Showing the previous answer while the next one loads.
    stale: !settled && state.data !== null,
  };
}
