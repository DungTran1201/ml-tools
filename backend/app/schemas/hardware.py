from pydantic import BaseModel, ConfigDict
from typing import Optional

class HardwareConfigResponse(BaseModel):
    id: str
    gpu_model: str
    gpu_count: int
    cpu_model: str
    ram_total_gb: int
    storage_type: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)

class HardwareMetricResponse(BaseModel):
    id: int
    run_id: Optional[str] = None
    epoch: Optional[int] = None
    gpu_index: int
    gpu_util_pct: float
    gpu_temp_c: float
    gpu_power_w: Optional[float] = None
    vram_used_gb: float
    vram_total_gb: float
    cpu_util_pct: float
    ram_used_gb: float
    ram_total_gb: float
    disk_read_gbps: Optional[float] = None
    disk_write_gbps: Optional[float] = None
    net_rx_gbps: Optional[float] = None
    net_tx_gbps: Optional[float] = None
    recorded_at: int

    model_config = ConfigDict(from_attributes=True)
