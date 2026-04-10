from pydantic import BaseModel

class ZoneUpdate(BaseModel):
    zoneId: int
    changes: dict