from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK
# Note: You need to download your serviceAccountKey.json from Firebase Console
# cred = credentials.Certificate("path/to/serviceAccountKey.json")
# firebase_admin.initialize_app(cred)
# db = firestore.client()

app = FastAPI(title="PhysioSync Analytics API")

class PaceStats(BaseModel):
    optimal: int = 0
    tooFast: int = 0
    tooSlow: int = 0

class ReportData(BaseModel):
    id: str
    userId: str
    date: datetime
    accuracy: int
    reps: int
    paceStats: PaceStats
    mistakes: List[str]

@app.get("/api/get-monthly-report")
async def get_monthly_report(user_id: str = Query(..., description="The ID of the patient")):
    """
    Returns aggregated data for the monthly report dashboard.
    """
    try:
        # Example using Firebase Admin SDK:
        # results_ref = db.collection('results').where('patientId', '==', user_id).stream()
        # results = [doc.to_dict() for doc in results_ref]
        
        # Mocking data for demonstration
        results = [
            {"accuracy": 85, "reps": 20, "paceStats": {"optimal": 15, "tooFast": 3, "tooSlow": 2}},
            {"accuracy": 90, "reps": 25, "paceStats": {"optimal": 20, "tooFast": 2, "tooSlow": 3}},
        ]
        
        if not results:
            return {"message": "No data found for this user."}
            
        total_sessions = len(results)
        total_reps = sum(r.get("reps", 0) for r in results)
        avg_accuracy = sum(r.get("accuracy", 0) for r in results) / total_sessions if total_sessions > 0 else 0
        
        total_optimal = sum(r.get("paceStats", {}).get("optimal", 0) for r in results)
        total_too_fast = sum(r.get("paceStats", {}).get("tooFast", 0) for r in results)
        total_too_slow = sum(r.get("paceStats", {}).get("tooSlow", 0) for r in results)
        
        return {
            "totalSessions": total_sessions,
            "totalReps": total_reps,
            "averageAccuracy": round(avg_accuracy, 2),
            "paceStats": {
                "optimal": total_optimal,
                "tooFast": total_too_fast,
                "tooSlow": total_too_slow
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-performance-history")
async def get_performance_history(
    user_id: str = Query(..., description="The ID of the patient"),
    time_range: str = Query("month", description="Time range: 'week' or 'month'")
):
    """
    Returns daily/session-wise data for charts.
    """
    try:
        # Example using Firebase Admin SDK:
        # results_ref = db.collection('results').where('patientId', '==', user_id).stream()
        # results = [{"id": doc.id, **doc.to_dict()} for doc in results_ref]
        
        # Mocking data for demonstration
        return {
            "history": [
                {"date": "2026-04-01", "accuracy": 85, "reps": 20},
                {"date": "2026-04-02", "accuracy": 88, "reps": 22},
                {"date": "2026-04-03", "accuracy": 92, "reps": 25},
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FrameData(BaseModel):
    landmarks: List[dict]
    exerciseType: str
    userId: str

@app.post("/api/analyze-frame")
async def analyze_frame(data: FrameData):
    """
    Analyzes a single frame of pose data and returns detailed metrics.
    """
    try:
        # In a real scenario, this could use a more complex ML model
        # For now, we return detailed analysis structure
        return {
            "status": "success",
            "analysis": {
                "postureScore": 95,
                "jointAngles": {
                    "leftKnee": 120,
                    "rightKnee": 122,
                    "backAngle": 175
                },
                "recommendations": ["Keep back straight", "Lower hips slightly"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class KneeBendData(BaseModel):
    landmarks: List[dict]
    userId: str
    reps: int
    activeLeg: Optional[str] = None

@app.post("/api/analyze-knee-bend")
async def analyze_knee_bend(data: KneeBendData):
    """
    Analyzes knee bend exercise data.
    """
    try:
        # Mock analysis for knee bend
        return {
            "status": "success",
            "repCount": data.reps,
            "activeLeg": data.activeLeg,
            "accuracyScore": 92,
            "mistakes": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class OverheadReachData(BaseModel):
    landmarks: List[dict]
    userId: str
    reps: int
    symmetryScore: Optional[float] = 100.0

@app.post("/api/analyze-overhead-reach")
async def analyze_overhead_reach(data: OverheadReachData):
    """
    Analyzes overhead reach exercise data.
    """
    try:
        # Mock analysis for overhead reach
        return {
            "status": "success",
            "repCount": data.reps,
            "accuracyScore": 95,
            "symmetryScore": data.symmetryScore or 98.5,
            "postureFeedback": "Good vertical alignment. Keep it up!",
            "mistakes": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
