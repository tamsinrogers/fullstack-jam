import { useState, useCallback, useEffect } from 'react';
import CompanyTable from './CompanyTable';
import useApi from '../utils/useApi';
import { getCollectionsMetadata, ICollection } from '../utils/jam-api';

const CompanyTableWrapper = () => {
  const { data: collections, loading: collectionsLoading, error: collectionsError } = useApi(
    useCallback(() => getCollectionsMetadata(), [])
  );

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const [targetCollectionId, setTargetCollectionId] = useState<string>();

  // Only set defaults when collections are loaded
  useEffect(() => {
    if (collections && collections.length > 0) {
      if (!selectedCollectionId) setSelectedCollectionId(collections[0].id);
      if (!targetCollectionId && collections.length > 1) setTargetCollectionId(collections[1].id);
    }
  }, [collections, selectedCollectionId, targetCollectionId]);

  if (collectionsLoading) return <p>Loading collections...</p>;
  if (collectionsError) return <p>Error loading collections: {collectionsError}</p>;
  if (!collections || collections.length === 0) return <p>No collections found.</p>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {collections.map((col: ICollection) => (
          <button
            key={col.id}
            style={{
              marginRight: 8,
              backgroundColor: col.id === selectedCollectionId ? '#4caf50' : '#ddd',
              color: col.id === selectedCollectionId ? 'white' : 'black',
              padding: '8px 12px',
              border: 'none',
              borderRadius: 4,
            }}
            onClick={() => setSelectedCollectionId(col.id)}
          >
            {col.collection_name}
          </button>
        ))}
      </div>

      {selectedCollectionId && targetCollectionId && (
        <CompanyTable
          selectedCollectionId={selectedCollectionId}
          targetCollectionId={targetCollectionId}
        />
      )}
    </div>
  );
};

export default CompanyTableWrapper;
