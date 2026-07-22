from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import time
import logging

from app.core.database import get_db
from app.models.training import HardwareConfig, HardwareMetric
from app.schemas.hardware import HardwareConfigResponse, HardwareMetricResponse
from app.core.websockets import manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/config", response_model=HardwareConfigResponse)
def get_hardware_config(db: Session = Depends(get_db)):
    """Fetch the machine metadata specs."""
    config = db.query(HardwareConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Hardware config not found")
    return config

@router.get("/metrics/latest", response_model=list[HardwareMetricResponse])
def get_latest_metrics(run_id: str | None = None, db: Session = Depends(get_db)):
    """Fetch the initial hydration window (last 60 seconds)."""
    sixty_seconds_ago = int(time.time()) - 60
    
    query = db.query(HardwareMetric).filter(HardwareMetric.recorded_at >= sixty_seconds_ago)
    
    # In Phase 3, we will filter by run_id vs idle, but for now we'll implement it as defined:
    if run_id:
        query = query.filter(HardwareMetric.run_id == run_id)
    else:
        # System idle metrics
        query = query.filter(HardwareMetric.run_id.is_(None))
        
    metrics = query.order_by(HardwareMetric.recorded_at.asc()).all()
    return metrics

@router.get("/metrics/history", response_model=list[HardwareMetricResponse])
def get_historical_metrics(run_id: str, epoch: int, db: Session = Depends(get_db)):
    """Fetch hardware metrics snapshot for a specific training epoch."""
    # Leveraging idx_hw_metric_epoch: (run_id, epoch)
    metrics = (
        db.query(HardwareMetric)
        .filter(HardwareMetric.run_id == run_id)
        .filter(HardwareMetric.epoch == epoch)
        .order_by(HardwareMetric.recorded_at.asc())
        .all()
    )
    return metrics

@router.websocket("/ws/{project_id}")
async def hardware_websocket(websocket: WebSocket, project_id: str):
    """WebSocket endpoint broadcasting the 1.2s tick payload directly to the frontend."""
    await manager.connect_hardware(websocket, project_id)
    try:
        while True:
            # We don't expect the client to send messages, but we need to keep the connection open
            # and detect disconnects.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_hardware(websocket, project_id)
    except Exception as e:
        logger.error(f"Hardware WebSocket error: {e}")
        manager.disconnect_hardware(websocket, project_id)
