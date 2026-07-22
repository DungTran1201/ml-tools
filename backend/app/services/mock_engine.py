import asyncio
import time
import random
import uuid
from datetime import datetime, timezone
import logging

from app.core.database import SessionLocal
from app.models.training import TrainingRun, RunMetric, RunLog
from app.core.websockets import manager

logger = logging.getLogger(__name__)

async def mock_watchdog_loop():
    """
    Heartbeat Watchdog daemon to detect zombie runs.
    Sweeps for 'running' runs whose updated_at is older than 30 seconds,
    and transitions them to 'failed'.
    """
    logger.info("Starting Watchdog Daemon...")
    while True:
        try:
            await check_zombie_runs()
        except asyncio.CancelledError:
            logger.info("Watchdog Daemon stopped.")
            break
        except Exception as e:
            logger.error(f"Error in Watchdog daemon: {e}")
        
        await asyncio.sleep(10)  # Check every 10 seconds

async def check_zombie_runs():
    db = SessionLocal()
    try:
        active_runs = db.query(TrainingRun).filter(TrainingRun.status == 'running').all()
        now_dt = datetime.now(timezone.utc)
        
        for run in active_runs:
            if run.updated_at:
                try:
                    updated_dt = datetime.strptime(run.updated_at, '%Y-%m-%dT%H:%M:%fZ').replace(tzinfo=timezone.utc)
                    if (now_dt - updated_dt).total_seconds() > 30:
                        logger.warning(f"Watchdog detected zombie run: {run.id}. Transitioning to failed.")
                        run.status = 'failed'
                        run.error_message = "Training Engine daemon crashed (Watchdog timeout)"
                        
                        # Add failure log
                        db.add(RunLog(
                            run_id=run.id,
                            line_number=run.epochs_completed + 1,
                            level="ERROR",
                            message="Run terminated ungracefully. Watchdog recovered state.",
                            logged_at=int(time.time())
                        ))
                except ValueError:
                    pass
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


async def mock_training_engine_loop():
    """
    Background daemon that simulates training progress.
    Periodically checks for 'running' runs and advances their epochs.
    """
    logger.info("Starting Mock Training Engine daemon...")
    while True:
        try:
            await advance_running_trainings()
        except asyncio.CancelledError:
            logger.info("Mock Training Engine daemon stopped.")
            break
        except Exception as e:
            logger.error(f"Error in mock training engine: {e}")
            
        await asyncio.sleep(5)  # Simulate 5 seconds per epoch

async def advance_running_trainings():
    # Use a fresh DB session for the background worker
    db = SessionLocal()
    try:
        # Find all runs that are currently "pending" and switch to "running"
        pending_runs = db.query(TrainingRun).filter(TrainingRun.status == 'pending').all()
        now_ts = int(time.time())
        now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')

        for prun in pending_runs:
            prun.status = 'running'
            prun.updated_at = now_str
            # Add initial log
            init_log = RunLog(
                run_id=prun.id,
                line_number=0,
                level="INFO",
                message="Training Engine started processing the run. Acquired GPU lock.",
                logged_at=now_ts
            )
            db.add(init_log)
            logger.info(f"Mock Engine picked up pending run {prun.id}, transitioned to running.")

        # Find all runs that are currently "running"
        active_runs = db.query(TrainingRun).filter(TrainingRun.status == 'running').all()
        
        if not active_runs:
            db.commit()
            return
            
        now_ts = int(time.time())
        now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%fZ')
        
        for run in active_runs:
            # Advance epoch
            new_epoch = run.epochs_completed + 1
            
            # Generate dummy metrics
            # Loss decreases, Accuracy increases logarithmically roughly
            progress = new_epoch / float(run.epochs_total)
            train_loss = max(0.01, 2.0 * (1 - progress) + random.uniform(-0.1, 0.1))
            val_loss = max(0.05, 2.2 * (1 - progress) + random.uniform(0.0, 0.2))
            train_acc = min(0.99, 0.1 + 0.8 * progress + random.uniform(-0.02, 0.02))
            val_acc = min(0.98, 0.1 + 0.75 * progress + random.uniform(-0.05, 0.05))
            
            # Insert Metric
            metric = RunMetric(
                run_id=run.id,
                step=new_epoch,
                train_loss=round(train_loss, 4),
                val_loss=round(val_loss, 4),
                train_acc=round(train_acc, 4),
                val_acc=round(val_acc, 4),
                recorded_at=now_ts
            )
            db.add(metric)
            
            # Insert Log
            log_msg = f"Epoch {new_epoch}/{run.epochs_total} completed. Train Loss: {train_loss:.4f}, Val Acc: {val_acc:.4f}"
            
            # Get max line number for this run
            # Simple approach: just use new_epoch as line number for the mock
            log_entry = RunLog(
                run_id=run.id,
                line_number=new_epoch,
                level="INFO",
                message=log_msg,
                logged_at=now_ts
            )
            db.add(log_entry)
            
            # Update Run
            run.epochs_completed = new_epoch
            run.updated_at = now_str
            run.train_loss = round(train_loss, 4)
            run.train_acc = round(train_acc, 4)
            run.best_val_loss = min((run.best_val_loss or 999.0), round(val_loss, 4))
            run.best_val_acc = max((run.best_val_acc or 0.0), round(val_acc, 4))
            
            # Check if finished
            if new_epoch >= run.epochs_total:
                run.status = 'completed'
                run.finished_at = now_str
                run.checkpoint_path = f"s3://ml-tools-checkpoints/{run.project_id}/{run.id}/best_model.pt"
                # Add final log
                final_log = RunLog(
                    run_id=run.id,
                    line_number=new_epoch + 1,
                    level="INFO",
                    message=f"Training completed successfully. Checkpoint saved to {run.checkpoint_path}",
                    logged_at=now_ts
                )
                db.add(final_log)
                logger.info(f"Run {run.id} completed.")
            else:
                logger.info(f"Run {run.id} advanced to epoch {new_epoch}/{run.epochs_total}.")
                
            # Broadcast the update via WebSocket
            await manager.broadcast_to_project(run.project_id, {
                "event": "run_update",
                "run_id": run.id,
                "project_id": run.project_id,
                "status": run.status,
                "epochs_completed": run.epochs_completed,
                "epochs_total": run.epochs_total,
                "train_loss": run.train_loss,
                "val_loss": val_loss,
                "train_acc": run.train_acc,
                "val_acc": val_acc,
                "best_val_acc": run.best_val_acc,
                "best_val_loss": run.best_val_loss,
                "latest_log": log_msg
            })
                
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
