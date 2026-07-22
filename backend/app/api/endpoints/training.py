from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.training import TrainingRunLaunch, TrainingRunResponse
from app.services.training_service import launch_run, TrainingServiceException
from app.api.deps import get_current_user, verify_project_access
from app.models.user import User
from app.core.websockets import manager

router = APIRouter()

@router.post("/launch", response_model=TrainingRunResponse, status_code=status.HTTP_201_CREATED)
def launch_training_run(
    payload: TrainingRunLaunch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_project_id: str = Depends(verify_project_access)
):
    """
    Launch a new training run.
    Validates preconditions (PRE-1 through PRE-7).
    """
    if payload.project_id != active_project_id:
        raise HTTPException(
            status_code=400, 
            detail="Payload project_id does not match the active X-Project-ID context."
        )

    try:
        run = launch_run(db=db, user_id=current_user.id, payload=payload)
        return run
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{run_id}/aggregate")
def get_run_aggregate_api(
    run_id: str,
    db: Session = Depends(get_db),
    active_project_id: str = Depends(verify_project_access)
):
    """
    Returns cached, aggregated run details, metrics, and logs.
    """
    from app.services.training_service import get_run_aggregate
    try:
        data = get_run_aggregate(db=db, run_id=run_id, project_id=active_project_id)
        return data
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{run_id}/pause")
def pause_run_api(
    run_id: str,
    db: Session = Depends(get_db),
    active_project_id: str = Depends(verify_project_access)
):
    from app.services.training_service import pause_run
    try:
        return pause_run(db=db, run_id=run_id, project_id=active_project_id)
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{run_id}/resume")
def resume_run_api(
    run_id: str,
    db: Session = Depends(get_db),
    active_project_id: str = Depends(verify_project_access)
):
    from app.services.training_service import resume_run
    try:
        return resume_run(db=db, run_id=run_id, project_id=active_project_id)
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{run_id}/stop")
def stop_run_api(
    run_id: str,
    db: Session = Depends(get_db),
    active_project_id: str = Depends(verify_project_access)
):
    from app.services.training_service import stop_run
    try:
        return stop_run(db=db, run_id=run_id, project_id=active_project_id)
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{run_id}/hyperparameters")
def update_hyperparameters_api(
    run_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    active_project_id: str = Depends(verify_project_access)
):
    from app.services.training_service import update_hyperparameters
    try:
        return update_hyperparameters(db=db, run_id=run_id, project_id=active_project_id, payload_dict=payload)
    except TrainingServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint for Dashboard Live Updates.
    Clients connect to a specific project_id to receive real-time metrics and logs.
    """
    # In a real app, we would extract a token from query params and verify access
    await manager.connect(websocket, project_id)
    try:
        while True:
            # We don't expect messages from the client in this one-way dashboard,
            # but we need to wait for them to detect disconnection.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
