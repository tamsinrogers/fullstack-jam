import randomname
from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.cors import CORSMiddleware

from backend.db import database
from backend.routes import collections, companies


@asynccontextmanager
async def lifespan(app: FastAPI):

    database.Base.metadata.create_all(bind=database.engine)

    db = database.SessionLocal()
    if not db.query(database.Settings).get("seeded"):
        seed_database(db)

        db.add(database.Settings(setting_name="seeded"))
        db.commit()
        db.close()
    yield

def seed_database(db: Session):
    db.execute(text("TRUNCATE TABLE company_collections CASCADE;"))
    db.execute(text("TRUNCATE TABLE companies CASCADE;"))
    db.execute(text("TRUNCATE TABLE company_collection_associations CASCADE;"))
    db.execute(text("DROP TRIGGER IF EXISTS throttle_updates_trigger ON company_collection_associations;"))
    db.commit()

    # Create 50,000 companies
    companies = [
        database.Company(company_name=randomname.get_name().replace("-", " ").title())
        for _ in range(50000)
    ]
    db.bulk_save_objects(companies)
    db.commit()

    # Create "My List" with all 50,000 companies
    my_list = database.CompanyCollection(collection_name="My List")
    db.add(my_list)
    db.commit()

    associations = [
        database.CompanyCollectionAssociation(
            company_id=company.id, collection_id=my_list.id
        )
        for company in db.query(database.Company).limit(50000).all()
    ]
    db.bulk_save_objects(associations)
    db.commit()

    # Create "Liked Companies List" EMPTY
    liked_companies = database.CompanyCollection(collection_name="Liked Companies List")
    db.add(liked_companies)
    db.commit()
    # Do NOT add any associations here

    # Throttle trigger to simulate slow inserts
    db.execute(
        text("""
CREATE OR REPLACE FUNCTION throttle_updates()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_sleep(0.1); -- Sleep for 100 milliseconds to simulate a slow update
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
        """)
    )

    db.execute(
        text("""
CREATE TRIGGER throttle_updates_trigger
BEFORE INSERT ON company_collection_associations
FOR EACH ROW
EXECUTE FUNCTION throttle_updates();
        """)
    )
    db.commit()


app = FastAPI(lifespan=lifespan)

app.include_router(companies.router)
app.include_router(collections.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite frontend origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
