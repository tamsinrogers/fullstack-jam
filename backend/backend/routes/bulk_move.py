import uuid
import time
import threading
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

router = APIRouter()

PROGRESS_STORE = {}

class BulkMoveRequest(BaseModel):
    toCollectionId: str
    companyIds: Optional[List[int]] = None
    all: Optional[bool] = False

class ProgressResponse(BaseModel):
    jobId: str
    status: str  
    processed: int
    total: int
    error: Optional[str] = None


def get_company_ids_for_collection(collection_id: str) -> List[int]:
    return list(range(1, 50001))  # pretend 50k companies

def move_companies_batch(from_collection: str, to_collection: str, ids: List[int]):
    time.sleep(0.05) 

def _run_bulk_move(job_id: str, from_collection: str, req: BulkMoveRequest):
    try:
        PROGRESS_STORE[job_id]["status"] = "running"
        
        if req.all:
            ids = get_company_ids_for_collection(from_collection)
        else:
            ids = req.companyIds or []
        total = len(ids)
        PROGRESS_STORE[job_id]["total"] = total
        PROGRESS_STORE[job_id]["processed"] = 0

        batch_size = 200 
        throttle_sleep = 0.1  # batch step

        for i in range(0, total, batch_size):
            if PROGRESS_STORE[job_id].get("cancelled"):
                PROGRESS_STORE[job_id]["status"] = "cancelled"
                return
            batch = ids[i:i+batch_size]
            move_companies_batch(from_collection, req.toCollectionId, batch)  
            PROGRESS_STORE[job_id]["processed"] += len(batch)

            PROGRESS_STORE[job_id]["percent"] = int(PROGRESS_STORE[job_id]["processed"] / max(1, total) * 100)

            time.sleep(throttle_sleep)

        PROGRESS_STORE[job_id]["status"] = "complete"
    except Exception as e:
        PROGRESS_STORE[job_id]["status"] = "failed"
        PROGRESS_STORE[job_id]["error"] = str(e)

@router.post("/api/collections/{from_collection_id}/bulk-move")
def start_bulk_move(from_collection_id: str, req: BulkMoveRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    PROGRESS_STORE[job_id] = {
        "jobId": job_id,
        "status": "queued",
        "processed": 0,
        "total": 0,
        "percent": 0,
        "error": None,
    }

    t = threading.Thread(target=_run_bulk_move, args=(job_id, from_collection_id, req), daemon=True)
    t.start()
    return {"jobId": job_id}

@router.get("/api/bulk-move/{job_id}/progress", response_model=ProgressResponse)
def get_bulk_move_progress(job_id: str):
    p = PROGRESS_STORE.get(job_id)
    if not p:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": job_id,
        "status": p["status"],
        "processed": p["processed"],
        "total": p["total"],
        "error": p.get("error"),
    }

@router.post("/api/bulk-move/{job_id}/cancel")
def cancel_bulk_move(job_id: str):
    p = PROGRESS_STORE.get(job_id)
    if not p:
        raise HTTPException(status_code=404, detail="Job not found")
    p["cancelled"] = True
    return {"ok": True}
