import { useCallback, useEffect, useState } from "react";

// Runs an async loader when deps change. fn may return null to skip.
export function useFetch(fn, deps) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setS((p) => ({ ...p, loading: true, error: null }));
    Promise.resolve(fn()).then(
      (data) => live && setS({ data, error: null, loading: false }),
      (error) => live && setS({ data: null, error, loading: false })
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...s, reload };
}
