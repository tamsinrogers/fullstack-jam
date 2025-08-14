import { DataGrid } from "@mui/x-data-grid";
import { useEffect, useState } from "react";
import { getCollectionsById, ICompany, addCompanies } from "../utils/jam-api";
import useApi from "../utils/useApi";

const CompanyTable = (props: { selectedCollectionId: string; targetCollectionId: number }) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>();
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { loading, execute: executeAddCompanies } = useApi(addCompanies);

  useEffect(() => {
    getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
      (newResponse) => {
        setResponse(newResponse.companies);
        setTotal(newResponse.total);
      }
    );
  }, [props.selectedCollectionId, offset, pageSize]);

  useEffect(() => {
    setOffset(0);
    setSelectedIds([]);
  }, [props.selectedCollectionId]);

  const handleAddToList = async () => {
    if (selectedIds.length === 0) return;
    try {
      await executeAddCompanies(props.targetCollectionId, selectedIds);
      alert(`Added ${selectedIds.length} companies to target list.`);
    } catch {
      alert("Failed to add companies.");
    }
  };

  return (
    <div style={{ height: 650, width: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={handleAddToList}
          disabled={selectedIds.length === 0 || loading}
        >
          {loading ? "Adding..." : `Add ${selectedIds.length} to List`}
        </button>
      </div>

      <DataGrid
        rows={response}
        rowHeight={30}
        columns={[
          { field: "liked", headerName: "Liked", width: 90 },
          { field: "id", headerName: "ID", width: 90 },
          { field: "company_name", headerName: "Company Name", width: 200 },
        ]}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25 },
          },
        }}
        rowCount={total}
        pagination
        checkboxSelection
        paginationMode="server"
        onPaginationModelChange={(newMeta) => {
          setPageSize(newMeta.pageSize);
          setOffset(newMeta.page * newMeta.pageSize);
        }}
        onRowSelectionModelChange={(ids) => {
          setSelectedIds(ids.map((id) => Number(id)));
        }}
      />
    </div>
  );
};

export default CompanyTable;
