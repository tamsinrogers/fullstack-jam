import uuid
from typing import Literal, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.db import database
from backend.db.database import (
    CompanyCollection,
    CompanyCollectionAssociation,
    CollectionAddProgress
)
from .collections import add_companies_in_batches

router = APIRouter(
    prefix="/bulk-move",
    tags=["bulk-move"],
)

class BulkMoveRequest(BaseModel):
    source_list_id: uuid.UUID
    target_list_id: uuid.UUID
    mode: Literal["subset", "all"]
    company_ids: Optional[list[int]] = None 

class JobStatusResponse(BaseModel):
    job_id: uuid.UUID
    status: str
    processed: int
    total: int
    percent_complete: float

def add_all_companies_job(db: Session, source_id: uuid.UUID, target_id: uuid.UUID):
    ids = [
        cid for (cid,) in db.query(CompanyCollectionAssociation.company_id)
        .filter(CompanyCollectionAssociation.collection_id == source_id)
        .all()
    ]
    add_companies_in_batches(db, ids, target_id)

@router.post("")
def start_bulk_move(
    req: BulkMoveRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    src = db.query(CompanyCollection).get(req.source_list_id)
    tgt = db.query(CompanyCollection).get(req.target_list_id)
    if not src or not tgt:
        raise HTTPException(status_code=404, detail="source not found not found")

    # progress bar
    job_id = uuid.uuid4()
    if req.mode == "subset":
        if not req.company_ids:
            raise HTTPException(status_code=400, detail="company_ids required for subset mode")
        total = len(req.company_ids)
    else:
        total = db.query(func.count()).select_from(CompanyCollectionAssociation)\
            .filter(CompanyCollectionAssociation.collection_id == req.source_list_id)\
            .scalar()

    progress = CollectionAddProgress(
        id=job_id,
        target_collection_id=req.target_list_id,
        total_companies=total,
        processed_companies=0,
        status="in_progress"
    )
    db.add(progress)
    db.commit()

    # start job
    if req.mode == "subset":
        background_tasks.add_task(add_companies_in_batches, db, req.company_ids, req.target_list_id)
    else:
        background_tasks.add_task(add_all_companies_job, db, req.source_list_id, req.target_list_id)

    return {"job_id": job_id, "status": "started", "total": total}

@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: uuid.UUID, db: Session = Depends(database.get_db)):
    progress = db.query(CollectionAddProgress).filter(CollectionAddProgress.id == job_id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")

    pct = (progress.processed_companies / progress.total_companies * 100) if progress.total_companies else 0.0
    return JobStatusResponse(
        job_id=progress.id,
        status=progress.status,
        processed=progress.processed_companies,
        total=progress.total_companies,
        percent_complete=round(pct, 2)
    )
