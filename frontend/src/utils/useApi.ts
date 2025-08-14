import { useState, useCallback } from "react";

const useApi = <T, Args extends any[]>(
  apiFunction: (...args: Args) => Promise<T>,

) => {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Args) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFunction(...args);
        setData(response);
        return response;
      } catch (err: any) {
        setError(err.message || "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction]
  );

  return { data, loading, error, execute };
};

export default useApi;
