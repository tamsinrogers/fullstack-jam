import { useState, useEffect, useCallback } from 'react';
import { bulkMoveCompanies, getBulkMoveProgress } from './jam-api';

const useApi = <T>(apiFunction: () => Promise<T>) => {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFunction();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
};

export default useApi;

export interface BulkMoveProgressResponse {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export const useBulkMoveCompanies = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const startBulkMove = async (
    sourceCollectionId: string,
    targetCollectionId: string,
    companyIds?: string[]
  ) => {
    if (!sourceCollectionId || !targetCollectionId) {
      setError('Source or target collection ID is missing');
      return;
    }

    try {
      setLoading(true);
      setProgress(0);
      setError(null);
      setSuccess(false);

      const { job_id } = await bulkMoveCompanies(
        sourceCollectionId,
        targetCollectionId,
        companyIds ?? []
      );

      let isComplete = false;
      let attempts = 0;
      const maxAttempts = 300;

      while (!isComplete && attempts < maxAttempts) {
        const progressRes: BulkMoveProgressResponse = await getBulkMoveProgress(job_id);
        setProgress(progressRes.progress ?? 0);

        if (progressRes.status === 'error') {
          throw new Error(progressRes.error || 'Bulk move failed');
        }

        if (progressRes.status === 'completed') {
          isComplete = true;
        } else {
          attempts++;
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      if (!isComplete) throw new Error('Bulk move timed out');

      setSuccess(true);
    } catch (err: any) {
      console.error('Bulk move error', err);
      setError(err.message || 'Error moving companies');
    } finally {
      setLoading(false);
    }
  };

  return { startBulkMove, loading, progress, error, success };
};
