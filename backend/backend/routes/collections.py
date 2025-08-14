import uuid

from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from .schemas import AddCompanies

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)
from backend.db.database import CompanyCollectionAssociation, CollectionAddProgress

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .get(collection_id)
        .collection_name,
        companies=companies,
        total=total_count,
    )

def batch_add_companies(
    db: Session,
    company_ids: list[uuid.UUID],
    target_id: uuid.UUID,
    batch_size: int = 100
):
    # track progress
    progress = CollectionAddProgress(
        target_collection_id=target_id,
        total_companies=len(company_ids),
        processed_companies=0,
        status="in_progress"
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    
    for i in range(0, len(company_ids), batch_size):
        batch_ids = company_ids[i:i + batch_size]

        # check for companies that may already be in target
        existing_assoc = db.query(CompanyCollectionAssociation.company_id)\
            .filter(
                CompanyCollectionAssociation.collection_id == target_id,
                CompanyCollectionAssociation.company_id.in_(batch_ids)
            ).all()
        
        existing_ids = {company_id for (company_id,) in existing_assoc}
        new_ids = [company_id for company_id in batch_ids if company_id not in existing_ids]

        associations = [
            CompanyCollectionAssociation(collection_id=target_id, company_id=added_id)
            for added_id in new_ids
        ]

        db.bulk_save_objects(associations)
        db.commit()

        progress.processed_companies += len(new_ids)
        db.commit()

    progress.status = "completed"
    db.commit()

@router.post("/add-companies")
async def add_companies_endpoint(
    request: AddCompanies,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    # ensure target collection exists
    target_collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == request.target_collection_id
    ).first()
    if not target_collection:
        raise HTTPException(status_code=404, detail="Target collection not found")

    # run background task in case of large list
    if len(request.company_ids) > 500:  
        background_tasks.add_task(
            batch_add_companies,
            db,
            request.company_ids,
            request.target_collection_id
        )
        return {
            "status": "in_progress",
            "message": f"adding {len(request.company_ids)} companies in background..."
        }

    # else: batch add companies
    batch_add_companies(db, request.company_ids, request.target_collection_id)
    return {"status": "completed", "added": len(request.company_ids)}

