import uuid
from pydantic import BaseModel
from typing import List

class TransferRequest(BaseModel):
    company_ids: List[uuid.UUID]           
    source_collection_id: uuid.UUID        
    target_collection_id: uuid.UUID        
