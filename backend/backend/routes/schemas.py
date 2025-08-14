import uuid
from pydantic import BaseModel
from typing import List

class AddCompanies(BaseModel):
    company_ids: List[uuid.UUID]           
    source_id: uuid.UUID            
    target_id: uuid.UUID       
