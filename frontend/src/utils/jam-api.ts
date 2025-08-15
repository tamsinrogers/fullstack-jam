import axios from 'axios';

export interface ICompany {
  id: string; //this is the UUID
  company_name: string;
  liked: boolean;
}

export interface ICollection {
  id: string;
  collection_name: string;
  companies: ICompany[];
  total: number;
}

export interface ICompanyBatchResponse {
  companies: ICompany[];
}

const BASE_URL = 'http://localhost:8000';

export async function getCompanies(
  offset?: number,
  limit?: number
): Promise<ICompanyBatchResponse> {
  const { data } = await axios.get(`${BASE_URL}/companies`, {
    params: { offset, limit },
  });
  return data;
}

export async function getCollectionsById(
  id: string,
  offset?: number,
  limit?: number
): Promise<ICollection> {
  const { data } = await axios.get(`${BASE_URL}/collections/${id}`, {
    params: { offset, limit },
  });
  return data;
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
  const { data } = await axios.get(`${BASE_URL}/collections`);
  return data;
}

export async function bulkMoveCompanies(
  sourceCollectionId: string,
  targetCollectionId: string,
  companyIds: string[]
): Promise<{ job_id: string }> {
  try {
    console.log('bulkMoveCompanies payload:', { sourceCollectionId, targetCollectionId, companyIds });

    const res = await fetch(`${BASE_URL}/collections/add-companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_collection_id: sourceCollectionId,
        target_collection_id: targetCollectionId,
        company_ids: companyIds,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Bulk move request failed:', res.status, res.statusText, text);
      throw new Error(`Bulk move request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('bulkMoveCompanies returned', data);
    if (!data.job_id) {
      throw new Error('bulkMoveCompanies response missing job_id');
    }
    return data;
  } catch (err) {
    console.error('bulkMoveCompanies error', err);
    throw err;
  }
}

export async function getBulkMoveProgress(
  jobId: string
): Promise<{ progress: number; status: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/collections/progress/${jobId}`);
    if (!res.ok) {
      const text = await res.text();
      console.error('Progress request failed:', res.status, res.statusText, text);
      throw new Error(`Progress request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('getBulkMoveProgress returned', data);
    return data;
  } catch (err) {
    console.error('getBulkMoveProgress error', err);
    throw err;
  }
}
