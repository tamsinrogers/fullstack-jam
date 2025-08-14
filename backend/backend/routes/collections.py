import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from .schemas import AddCompanies

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)

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
    from backend.db.database import CompanyCollectionAssociation

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
            CompanyCollectionAssociation(collection_id=target_id, company_id=cid)
            for cid in new_ids
        ]
        db.bulk_save_objects(associations)
        db.commit()
