import asyncio
import sqlite3
import sys

from app.services.mock_engine import advance_running_trainings
from test_launch import test_launch_api, get_seeded_ids
from app.core.database import SessionLocal
from app.models.training import TrainingRun, RunMetric, RunLog

async def test_mock_engine():
    db = SessionLocal()
    
    # Clean up previous test runs if any
    db.query(RunLog).delete()
    db.query(RunMetric).delete()
    db.query(TrainingRun).delete()
    db.commit()

    # Launch a new run by invoking the endpoint via test_launch_api logic or directly
    print("Launching run for testing...")
    try:
        test_launch_api()
    except Exception as e:
        print(f"Ignored error in launch: {e}")
        pass
    
    run = db.query(TrainingRun).filter(TrainingRun.name == "My ResNet Run").first()
    
    if not run:
        print("Run not found!")
        sys.exit(1)
        
    print(f"Run started with ID: {run.id}, epochs_total={run.epochs_total}")
    
    # We will simulate 3 ticks of the engine
    for i in range(1, 4):
        print(f"\nTick {i}...")
        await advance_running_trainings()
        
        # Verify DB updates
        db.refresh(run)
        print(f"Epochs completed: {run.epochs_completed}")
        
        metrics = db.query(RunMetric).filter(RunMetric.run_id == run.id).all()
        print(f"Metrics count: {len(metrics)}")
        
        logs = db.query(RunLog).filter(RunLog.run_id == run.id).all()
        print(f"Logs count: {len(logs)}")
        
        assert run.epochs_completed == i, f"Expected {i}, got {run.epochs_completed}"
        assert len(metrics) == i, "Mismatch in metrics"
        assert len(logs) == i, "Mismatch in logs"
        
    print("\nMock Engine test passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_mock_engine())
