import { useState } from 'react';
import { bulkMoveCompanies, getBulkMoveProgress } from './jam-api';

export function useBulkMoveCompanies() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const startBulkMove = async (
    sourceCollectionId: string,
    targetCollectionId: string,
    companyIds: string[]
  ) => {
    if (companyIds.length === 0) {
      console.warn('No valid UUIDs selected, aborting bulk move');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      setProgress(0);

      const res = await bulkMoveCompanies(sourceCollectionId, targetCollectionId, companyIds);
      const jobId = res.job_id;

      let isComplete = false;
      while (!isComplete) {
        const { progress: p, status, error: errMsg } = await getBulkMoveProgress(jobId);
        setProgress(p);

        if (status === 'error') throw new Error(errMsg || 'Bulk move failed');
        if (status === 'completed') isComplete = true;
        else await new Promise((r) => setTimeout(r, 1000));
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error moving companies');
    } finally {
      setLoading(false);
    }
  };

  return { startBulkMove, loading, progress, error, success };
}
