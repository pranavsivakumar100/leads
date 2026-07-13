from pydantic import BaseModel, Field


class LeadSearchRequest(BaseModel):
    service: str = Field(..., description="Preset label (e.g. 'HVAC') or a raw query.")
    location: str = Field(..., description="City / area, e.g. 'Newark NJ'.")
    deep: bool = Field(True, description="Tile a grid for deeper coverage (slower).")
    max_results: int = Field(300, ge=1, le=500)
    radius_km: float = Field(15.0, ge=1.0, le=80.0, description="Search radius from center.")


class Lead(BaseModel):
    place_id: str = ""
    name: str
    phone: str = ""
    website: str = ""
    address: str = ""
    rating: float | None = None
    reviews: int = 0
    score: float = 0.0
    has_website: bool = False
    status: str = ""
    maps_uri: str = ""


class LeadSearchResponse(BaseModel):
    service: str
    location: str
    total: int
    leads: list[Lead]
    search_id: str | None = None


class SearchHistoryItem(BaseModel):
    id: str
    service: str
    location: str
    deep: bool
    radius_km: float | None = None
    total_results: int
    created_at: str


class DashboardStats(BaseModel):
    total_leads: int = 0
    searches_run: int = 0
    markets: int = 0
    avg_leads_per_search: float = 0.0


class LibraryLead(BaseModel):
    place_id: str
    name: str
    phone: str = ""
    website: str = ""
    address: str = ""
    rating: float | None = None
    reviews: int = 0
    score: float = 0.0
    has_website: bool = False
    status: str = ""
    maps_uri: str = ""
    outreach_status: str = "new"
    service: str = ""
    location: str = ""
    times_seen: int = 1
    created_at: str = ""


class OutreachStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(new|contacted|interested|passed)$")


class CampaignStatusCounts(BaseModel):
    new: int = 0
    contacted: int = 0
    interested: int = 0
    passed: int = 0


class Campaign(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: str
    lead_count: int = 0
    status_counts: CampaignStatusCounts = CampaignStatusCounts()


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: str = Field("", max_length=300)


class CampaignAddLeads(BaseModel):
    place_ids: list[str] = Field(..., min_length=1, max_length=1000)


class LeadExportRequest(BaseModel):
    service: str
    location: str
    leads: list[Lead]


class ServicePreset(BaseModel):
    label: str
    query: str


class LocationSuggestion(BaseModel):
    place_id: str
    label: str
    main_text: str = ""
    secondary_text: str = ""
