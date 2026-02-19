"""
FastAPI backend for ITA Attendance Portal
Hosted as Vercel Serverless Function
"""
import os
import json
import traceback
from datetime import datetime, timezone
from typing import Optional, List

# Import dependencies - Vercel will install from requirements.txt
from fastapi import FastAPI, HTTPException, Depends, Header, APIRouter
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from supabase import create_client, Client
import pytz

# Initialize FastAPI app
# Vercel detects FastAPI by looking for an 'app' variable at module level
# This MUST be defined unconditionally for Vercel's static analysis
app = FastAPI(title="ITA Attendance API")

# Create API router with /api prefix
# Vercel rewrites preserve the original path, so routes need /api prefix
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# Initialize Supabase clients
def get_supabase_client() -> Client:
    """Get Supabase client with anon key"""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def get_supabase_admin_client() -> Client:
    """Get Supabase admin client with service role key"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase admin configuration missing")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Authentication
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Extract and verify JWT token from Authorization header
    Returns the decoded user payload
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    
    try:
        # Verify and decode JWT
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase tokens don't have standard aud claim
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

async def get_current_profile(user: dict = Depends(get_current_user)) -> dict:
    """
    Get user profile from database using authenticated user ID
    """
    supabase = get_supabase_client()
    user_id = user.get("sub") or user.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    response = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile = response.data
    
    # Check if profile is active and approved
    if not profile.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    if not profile.get("is_approved"):
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    return profile

# Helper functions
def is_after_daily_cutoff(date: datetime) -> bool:
    """Check if current time is after daily cutoff (11:00 PM PST for testing, 3:00 PM PST for production)"""
    pacific_tz = pytz.timezone("America/Los_Angeles")
    pacific_time = date.astimezone(pacific_tz)
    
    # For testing: 23:00 (11 PM), for production: 15:00 (3 PM)
    cutoff_hour = 23  # Change to 15 for production
    cutoff = pacific_time.replace(hour=cutoff_hour, minute=0, second=0, microsecond=0)
    
    return pacific_time >= cutoff

def capitalize_name(name: str) -> str:
    """Capitalize the first letter of each word in a name"""
    if not name or not name.strip():
        return name
    
    import re
    words = name.strip().split()
    result = []
    
    for word in words:
        # Split by apostrophes and hyphens
        parts = re.split(r"(['-])", word)
        capitalized_parts = []
        
        for i, part in enumerate(parts):
            if part in ["'", "-"]:
                capitalized_parts.append(part)
            else:
                capitalized_parts.append(part[0].upper() + part[1:].lower() if part else "")
        
        result.append("".join(capitalized_parts))
    
    return " ".join(result)

# Request/Response models
from pydantic import BaseModel

class AttendanceEntryInput(BaseModel):
    studentId: str
    status: str  # "present" | "absent" | "late" | "left_early"
    comments: Optional[str] = None

class SaveAttendanceRequest(BaseModel):
    sectionId: str
    attendanceDate: str
    schoolYear: str
    entries: List[AttendanceEntryInput]

class AttendanceResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

# Routes
# Root endpoint (without /api prefix for health checks)
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "ITA Attendance API"}

# API routes with /api prefix (mounted on api_router)
@api_router.get("/test")
async def test():
    """Test endpoint to verify Python backend is accessible"""
    return {"status": "Python is alive", "message": "Backend connection successful"}

@api_router.post("/attendance", response_model=AttendanceResponse)
async def save_attendance(
    payload: SaveAttendanceRequest,
    profile: dict = Depends(get_current_profile)
):
    """
    Save attendance records
    Migrated from TypeScript saveAttendance Server Action
    """
    # Check daily cutoff
    if is_after_daily_cutoff(datetime.now(timezone.utc)):
        return JSONResponse(
            status_code=400,
            content={"error": "Attendance is locked after 3:00 PM PT."}
        )
    
    supabase = get_supabase_client()
    admin_supabase = get_supabase_admin_client()
    
    # Check if date is a holiday
    holiday_response = supabase.table("holidays").select("holiday_date").eq(
        "school_year", payload.schoolYear
    ).eq("holiday_date", payload.attendanceDate).maybe_single().execute()
    
    if holiday_response.data:
        return JSONResponse(
            status_code=400,
            content={"error": "This date is marked as a holiday."}
        )
    
    # Get student data
    student_ids = [entry.studentId for entry in payload.entries]
    students_response = supabase.table("students").select(
        "id,student_identifier,section_id"
    ).in_("id", student_ids).execute()
    
    if not students_response.data:
        return JSONResponse(
            status_code=400,
            content={"error": "No students found"}
        )
    
    # Create student map
    student_map = {row["id"]: row for row in students_response.data}
    
    # Prepare upsert data
    upserts = []
    for entry in payload.entries:
        student = student_map.get(entry.studentId)
        if not student or not student.get("student_identifier"):
            return JSONResponse(
                status_code=400,
                content={"error": f"Student {entry.studentId} is missing student_identifier"}
            )
        
        upserts.append({
            "student_id": entry.studentId,
            "student_identifier": student["student_identifier"],
            "section_id": student.get("section_id"),
            "recorded_by": profile["id"],
            "attendance_date": payload.attendanceDate,
            "status": entry.status,
            "comments": entry.comments,
            "school_year": payload.schoolYear,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    # Upsert attendance records
    attendance_response = admin_supabase.table("attendance").upsert(
        upserts,
        on_conflict="student_id,attendance_date"
    ).execute()
    
    if attendance_response.data is None:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to save attendance"}
        )
    
    return {"success": "Attendance saved."}

# Mount the API router to the app
app.include_router(api_router)

# Vercel FastAPI Auto-Detection
# Vercel automatically detects FastAPI apps by looking for 'app' variable at module level
# No custom handler needed - Vercel handles FastAPI routing automatically
# The 'app' variable defined above is what Vercel uses for routing

