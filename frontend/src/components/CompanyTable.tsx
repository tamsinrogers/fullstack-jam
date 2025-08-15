import { DataGrid } from '@mui/x-data-grid';
import { useEffect, useState } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import { getCollectionsById, ICompany } from '../utils/jam-api';
import { useBulkMoveCompanies } from '../utils/useApi';

interface Props {
  selectedCollectionId: string;
  targetCollectionId: string;
}

const CompanyTable = ({ selectedCollectionId, targetCollectionId }: Props) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { startBulkMove, loading, progress, success, error } = useBulkMoveCompanies();

  useEffect(() => {
    getCollectionsById(selectedCollectionId, offset, pageSize).then((data) => {
      setResponse(data.companies);
      setTotal(data.total);
      console.log('Fetched companies:', data.companies);
    });
  }, [selectedCollectionId, offset, pageSize]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds([]);
  }, [selectedCollectionId]);

  const handleAddSelected = () => {
    const validUUIDs = response
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => c.id);

    if (validUUIDs.length === 0) {
      console.warn('No valid UUIDs selected, aborting bulk move');
      return;
    }

    startBulkMove(selectedCollectionId, targetCollectionId, validUUIDs);
  };

  const handleSelectAll = () => setSelectedIds(response.map((c) => c.id));
  const handleDeselectAll = () => setSelectedIds([]);

  return (
    <div style={{ height: 700, width: '100%' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={handleAddSelected} disabled={selectedIds.length === 0 || loading}>
          {loading ? `Adding... (${progress ?? 0}%)` : `Add ${selectedIds.length} to List`}
        </button>
        <button onClick={handleSelectAll} disabled={selectedIds.length === response.length || loading}>
          Select All
        </button>
        <button onClick={handleDeselectAll} disabled={selectedIds.length === 0 || loading}>
          Deselect All
        </button>
        {success && <span style={{ color: 'green' }}>Added successfully!</span>}
        {error && <span style={{ color: 'red' }}>Failed to add.</span>}
      </div>

      {loading && <LinearProgress variant="determinate" value={progress} />}

      <DataGrid
        rows={response}
        rowHeight={30}
        columns={[{ field: 'company_name', headerName: 'Company Name', width: 200 }]}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize } } }}
        rowCount={total}
        pagination
        checkboxSelection
        paginationMode="server"
        onPaginationModelChange={(newMeta) => {
          setPageSize(newMeta.pageSize);
          setOffset(newMeta.page * newMeta.pageSize);
        }}
        onRowSelectionModelChange={(ids) => setSelectedIds(ids.map((id) => String(id)))}
        rowSelectionModel={selectedIds}
      />
    </div>
  );
};

export default CompanyTable;
