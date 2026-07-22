import asyncio
import time
import random
import logging

from app.core.database import SessionLocal
from app.models.training import TrainingRun, HardwareMetric, HardwareConfig
from app.core.websockets import manager
from app.schemas.hardware import HardwareMetricResponse

logger = logging.getLogger(__name__)

async def mock_hardware_daemon_loop():
    """
    Background daemon that simulates hardware telemetry (NVML).
    Polls at 1.2s interval.
    """
    logger.info("Starting Mock Hardware Daemon...")
    while True:
        try:
            await generate_hardware_metrics()
        except asyncio.CancelledError:
            logger.info("Mock Hardware Daemon stopped.")
            break
        except Exception as e:
            logger.error(f"Error in mock hardware daemon: {e}")
            
        await asyncio.sleep(1.2)  # Hardware polling interval

async def generate_hardware_metrics():
    db = SessionLocal()
    try:
        # Check for active training runs
        active_run = db.query(TrainingRun).filter(TrainingRun.status == 'running').first()
        
        # Get machine config to know how many GPUs we have
        hw_config = db.query(HardwareConfig).first()
        gpu_count = hw_config.gpu_count if hw_config else 4
        ram_total = hw_config.ram_total_gb if hw_config else 512
        
        now_ts = int(time.time())
        
        metrics = []
        for gpu_idx in range(gpu_count):
            if active_run:
                # High utilization simulated during training
                gpu_util = random.uniform(85.0, 99.0)
                gpu_temp = random.uniform(70.0, 85.0)
                gpu_power = random.uniform(250.0, 350.0)
                vram_used = random.uniform(40.0, 78.0)
                cpu_util = random.uniform(40.0, 80.0)
                ram_used = random.uniform(100.0, 250.0)
                disk_read = random.uniform(0.5, 2.5)
                disk_write = random.uniform(0.1, 1.0)
                net_rx = random.uniform(0.01, 0.1)
                net_tx = random.uniform(0.01, 0.1)
            else:
                # Idle metrics
                gpu_util = random.uniform(0.0, 5.0)
                gpu_temp = random.uniform(35.0, 45.0)
                gpu_power = random.uniform(20.0, 40.0)
                vram_used = random.uniform(0.5, 2.0)
                cpu_util = random.uniform(1.0, 10.0)
                ram_used = random.uniform(10.0, 20.0)
                disk_read = random.uniform(0.0, 0.05)
                disk_write = random.uniform(0.0, 0.05)
                net_rx = random.uniform(0.0, 0.01)
                net_tx = random.uniform(0.0, 0.01)

            metric = HardwareMetric(
                run_id=active_run.id if active_run else None,
                epoch=active_run.epochs_completed if active_run else None,
                gpu_index=gpu_idx,
                gpu_util_pct=round(gpu_util, 1),
                gpu_temp_c=round(gpu_temp, 1),
                gpu_power_w=round(gpu_power, 1),
                vram_used_gb=round(vram_used, 1),
                vram_total_gb=80.0,  # Based on A100 80GB
                cpu_util_pct=round(cpu_util, 1),
                ram_used_gb=round(ram_used, 1),
                ram_total_gb=float(ram_total),
                disk_read_gbps=round(disk_read, 2),
                disk_write_gbps=round(disk_write, 2),
                net_rx_gbps=round(net_rx, 3),
                net_tx_gbps=round(net_tx, 3),
                recorded_at=now_ts
            )
            metrics.append(metric)
            
        db.add_all(metrics)
        db.commit()
        
        # Broadcast via WebSockets
        # Convert SQLAlchemy models to dicts using Pydantic schema
        metric_dicts = [HardwareMetricResponse.model_validate(m).model_dump() for m in metrics]
        payload = {
            "event": "hardware_tick",
            "metrics": metric_dicts
        }
        
        if active_run:
            await manager.broadcast_hardware(active_run.project_id, payload)
        else:
            # Broadcast idle metrics to all connected project views
            for pid in list(manager.hardware_connections.keys()):
                await manager.broadcast_hardware(pid, payload)

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
