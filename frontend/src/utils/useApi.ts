import { useEffect, useState } from 'react';
import { bulkMoveCompanies, getBulkMoveProgress } from './jam-api';


const useApi = <T>(apiFunction: () => Promise<T>) => {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiFunction()
      .then((response) => {
        if (mounted) setData(response);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Unknown error');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false; // cancel if component unmounts
    };
  }, [apiFunction]);

  return { data, loading, error };
};

interface BulkMoveProgressResponse {
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
      setError(null);
      setSuccess(false);
      setProgress(0);

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

export default useApi;
