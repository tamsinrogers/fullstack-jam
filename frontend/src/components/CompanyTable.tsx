import { DataGrid } from '@mui/x-data-grid';
import LinearProgress from '@mui/material/LinearProgress';
import { useEffect, useState, useCallback } from 'react';
import useApi, { useBulkMoveCompanies } from '../utils/useApi';
import { getCollectionsById, ICompany } from '../utils/jam-api';

interface Props {
  selectedCollectionId: string; // source collection
  targetCollectionId: string;   // target collection
}

const CompanyTable = ({ selectedCollectionId, targetCollectionId }: Props) => {
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { startBulkMove, loading: moving, progress, success, error: moveError } =
    useBulkMoveCompanies();

  // Stable API function with useCallback
  const fetchCollection = useCallback(
    () => getCollectionsById(selectedCollectionId, offset, pageSize),
    [selectedCollectionId, offset, pageSize]
  );

  const { data: collection, loading: fetching, error: fetchError, reload } = useApi(fetchCollection);

  const companies: ICompany[] = collection?.companies ?? [];
  const total = collection?.total ?? 0;

  // Reset offset and selection when collection changes
  useEffect(() => {
    setOffset(0);
    setSelectedIds([]);
  }, [selectedCollectionId]);

  const handleAddSelected = async () => {
    const validUUIDs = companies.filter(c => selectedIds.includes(c.id)).map(c => c.id);
    if (validUUIDs.length === 0) return;

    await startBulkMove(selectedCollectionId, targetCollectionId, validUUIDs);
    setSelectedIds([]);
    reload?.(); // refresh the source collection
  };

  const handleAddAll = async () => {
    await startBulkMove(selectedCollectionId, targetCollectionId);
    setSelectedIds([]);
    reload?.(); // refresh the source collection
  };

  const handleSelectAll = () => setSelectedIds(companies.map(c => c.id));
  const handleDeselectAll = () => setSelectedIds([]);

  return (
    <div style={{ height: 700, width: '100%' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={handleAddSelected} disabled={selectedIds.length === 0 || moving}>
          {moving ? `Moving... (${progress ?? 0}%)` : `Move ${selectedIds.length} to List`}
        </button>

        <button onClick={handleAddAll} disabled={moving || companies.length === 0}>
          Move All
        </button>

        <button onClick={handleSelectAll} disabled={selectedIds.length === companies.length || moving}>
          Select All
        </button>

        <button onClick={handleDeselectAll} disabled={selectedIds.length === 0 || moving}>
          Deselect All
        </button>

        {success && <span style={{ color: 'green' }}>✅ Moved successfully!</span>}
        {moveError && <span style={{ color: 'red' }}>❌ Failed to move.</span>}
        {fetchError && <span style={{ color: 'red' }}>❌ Failed to fetch companies.</span>}
      </div>

      {(moving || fetching) && <LinearProgress variant="determinate" value={progress} />}

      <DataGrid
        rows={companies}
        rowHeight={30}
        columns={[{ field: 'company_name', headerName: 'Company Name', width: 250 }]}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize } } }}
        rowCount={total}
        pagination
        checkboxSelection
        paginationMode="server"
        onPaginationModelChange={(newMeta) => {
          setPageSize(newMeta.pageSize);
          setOffset(newMeta.page * newMeta.pageSize);
        }}
        onRowSelectionModelChange={(ids) => setSelectedIds(ids.map(String))}
        rowSelectionModel={selectedIds}
        loading={fetching}
      />
    </div>
  );
};

export default CompanyTable;
