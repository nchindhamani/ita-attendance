"""
FastAPI backend for ITA Attendance Portal
Hosted as Vercel Serverless Function
"""
import os
import json
import traceback
import csv
import io
import base64
import hmac
import hashlib
import time
import logging
from datetime import datetime, timezone
from typing import Optional, List
from functools import lru_cache
from pathlib import Path

# Configure logging for Vercel (must be before dotenv so we can log)
# Vercel captures stdout/stderr, so we configure logging to write to stderr
# Also use print() as fallback since Vercel reliably captures print statements
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr,  # Write to stderr for Vercel
    force=True  # Override any existing configuration
)
logger = logging.getLogger(__name__)

# Also create a helper that logs to both logger and print for maximum visibility
def log_error(msg: str, *args, **kwargs):
    """Log error to both logger and print for Vercel visibility"""
    logger.error(msg, *args, **kwargs)
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)

def log_info(msg: str, *args, **kwargs):
    """Log info to both logger and print for Vercel visibility"""
    logger.info(msg, *args, **kwargs)
    print(f"INFO: {msg}", file=sys.stderr, flush=True)

def log_warning(msg: str, *args, **kwargs):
    """Log warning to both logger and print for Vercel visibility"""
    logger.warning(msg, *args, **kwargs)
    print(f"WARNING: {msg}", file=sys.stderr, flush=True)

# Load environment variables from .env.local for local development
# Vercel automatically provides environment variables, so this only runs locally
try:
    from dotenv import load_dotenv
    # Use absolute paths to avoid issues with working directory
    script_file = Path(__file__).resolve()  # api/index.py (absolute)
    script_dir = script_file.parent  # api/ (absolute)
    project_root = script_dir.parent  # project root (absolute)
    
    # Primary location: project root
    env_file = project_root / ".env.local"
    
    if env_file.exists():
        result = load_dotenv(dotenv_path=env_file, override=True)
        log_info(f"✅ Loaded .env.local from {env_file} (result: {result})")
        # Verify it worked
        test_url = os.environ.get("VITE_SUPABASE_URL", "")
        if test_url:
            log_info(f"✅ Verified: VITE_SUPABASE_URL is set (starts with: {test_url[:30]}...)")
        else:
            log_warning("⚠️  .env.local loaded but VITE_SUPABASE_URL not found in environment")
    else:
        log_warning(f"⚠️  .env.local not found at {env_file}")
        log_warning(f"   Script file: {script_file}")
        log_warning(f"   Project root: {project_root}")
        log_warning(f"   CWD: {Path.cwd()}")
except ImportError:
    # python-dotenv not installed, skip (Vercel doesn't need it)
    log_warning("⚠️  python-dotenv not installed, skipping .env.local loading")
except Exception as e:
    # Log but don't fail if .env.local doesn't exist or can't be loaded
    log_warning(f"⚠️  Could not load .env.local: {str(e)}")
    import traceback
    log_warning(f"   Traceback: {traceback.format_exc()}")

# Import dependencies - Vercel will install from requirements.txt
from fastapi import FastAPI, HTTPException, Depends, Header, APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
import jwt
from jwt.exceptions import InvalidTokenError, DecodeError
from jwt import PyJWKClient
from supabase import create_client, Client
import pytz
import traceback
import httpx

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

# Global exception handler to ensure all errors return JSON
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and return JSON error response"""
    error_detail = str(exc)
    error_type = type(exc).__name__
    traceback_str = traceback.format_exc()
    
    # Log the full traceback for debugging (in production, log to a service)
    log_error(f"Unhandled exception ({error_type}): {error_detail}")
    log_error(f"Traceback: {traceback_str}")
    
    # Always return detailed error in preview/production for debugging
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": error_detail,
            "type": error_type,
            "message": f"{error_type}: {error_detail}"
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors and return JSON"""
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "detail": str(exc)
        }
    )

# Environment variables
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# Log environment variable status (for debugging, don't log actual secrets)
log_info(f"Environment loaded - SUPABASE_URL present: {bool(SUPABASE_URL)}")
if SUPABASE_URL:
    log_info(f"SUPABASE_URL starts with: {SUPABASE_URL[:30]}...")

# Extract project ID from Supabase URL for JWKS endpoint
def get_supabase_project_id() -> Optional[str]:
    """Extract project ID from Supabase URL"""
    if not SUPABASE_URL:
        return None
    try:
        # URL format: https://<project_id>.supabase.co
        parts = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")
        if len(parts) > 0:
            return parts[0]
    except Exception:
        pass
    return None

# JWKS client for fetching public keys (cached)
_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client for Supabase"""
    global _jwks_client
    if _jwks_client is None:
        project_id = get_supabase_project_id()
        if not project_id:
            raise HTTPException(status_code=500, detail="Cannot determine Supabase project ID")
        
        jwks_url = f"https://{project_id}.supabase.co/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client

def get_signing_key_from_jwks(kid: str):
    """Get signing key from JWKS by key ID"""
    jwks_client = get_jwks_client()
    try:
        signing_key = jwks_client.get_signing_key(kid)
        return signing_key.key
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Failed to get signing key from JWKS: {str(e)}")

# Initialize Supabase clients
def get_supabase_client(access_token: Optional[str] = None) -> Client:
    """
    Get Supabase client with anon key
    If access_token is provided, sets the session for RLS policies
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    # If access token is provided, set it for RLS policies
    # The Supabase Python client needs the session to be set for RLS
    if access_token:
        try:
            # Set the access token in the client's session
            # This allows RLS policies to identify the authenticated user
            # The Supabase Python client uses this to set the Authorization header
            client.auth.set_session(
                access_token=access_token,
                refresh_token=access_token  # Use access_token as refresh_token for server-side
            )
            log_info(f"Successfully set session with access token for RLS")
        except Exception as e:
            log_error(f"Failed to set session with access token: {e}")
            # Try alternative method: set headers directly
            try:
                # Alternative: Set the Authorization header directly on the postgrest client
                if hasattr(client, 'postgrest') and hasattr(client.postgrest, 'session'):
                    client.postgrest.auth(access_token)
                    log_info(f"Set auth token via postgrest client")
            except Exception as e2:
                log_error(f"Failed to set auth via postgrest: {e2}")
                # Continue without session - might fail RLS checks
    
    return client

def get_supabase_admin_client() -> Client:
    """Get Supabase admin client with service role key (bypasses RLS)"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase admin configuration missing")
    log_info(f"Creating admin client with URL: {SUPABASE_URL[:30]}... and service role key present: {bool(SUPABASE_SERVICE_ROLE_KEY)}")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    log_info("Admin client created successfully")
    return client

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
    
    try:
        # Decode token header to check algorithm and key ID
        try:
            header_part = token.split('.')[0]
            header_part += '=' * (4 - len(header_part) % 4)
            header_bytes = base64.urlsafe_b64decode(header_part)
            header_dict = json.loads(header_bytes)
            token_algorithm = header_dict.get("alg", "HS256")
            key_id = header_dict.get("kid")  # Key ID for JWKS lookup
            logger.info(f"Token algorithm: {token_algorithm}, Key ID: {key_id}")
        except Exception as e:
            logger.warning(f"Error reading token header: {e}")
            token_algorithm = "HS256"
            key_id = None
        
        # Determine verification key based on algorithm
        if token_algorithm == "ES256":
            # ES256: Fetch public key from Supabase JWKS
            if not key_id:
                raise HTTPException(status_code=401, detail="Token missing key ID (kid) for ES256 verification")
            
            try:
                verification_key = get_signing_key_from_jwks(key_id)
                logger.info("Using public key from JWKS for ES256 verification")
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Failed to get public key from JWKS: {str(e)}")
        elif token_algorithm == "HS256":
            # HS256: Use JWT secret
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(status_code=500, detail="JWT secret not configured")
            verification_key = SUPABASE_JWT_SECRET
            logger.info("Using JWT secret for HS256 verification")
        else:
            raise HTTPException(
                status_code=401,
                detail=f"Unsupported token algorithm: {token_algorithm}. Only HS256 and ES256 are supported."
            )
        
        # Decode and verify token with appropriate key and algorithms
        payload = jwt.decode(
            token,
            verification_key,
            algorithms=["HS256", "ES256"],  # Allow both algorithms
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": False  # Supabase tokens don't have standard aud claim
            }
        )
        return payload
        
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except jwt.InvalidSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token signature. Please sign out and sign in again."
        )
    except jwt.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Token decode error: {str(e)}")
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status_code=401, detail=f"Token verification failed: {error_msg}")

async def get_current_profile(
    user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
) -> dict:
    """
    Get user profile from database using authenticated user ID
    Uses the JWT token for RLS policies
    """
    # Extract access token from Authorization header for RLS
    access_token = None
    if authorization:
        try:
            scheme, token = authorization.split()
            if scheme.lower() == "bearer":
                access_token = token
        except ValueError:
            pass
    
    # Create authenticated Supabase client with user's JWT token
    supabase = get_supabase_client(access_token=access_token)
    user_id = user.get("sub") or user.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    
    # Log the user_id being used in the query
    log_info(f"Profile query - user_id: {user_id}")
    log_info(f"Profile query - user object keys: {list(user.keys())}")
    log_info(f"Profile query - user object: {json.dumps(user, default=str)}")
    
    response = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    
    # Log the full response object before None check
    log_info(f"Profile query - response type: {type(response)}")
    log_info(f"Profile query - response: {response}")
    if response is not None:
        log_info(f"Profile query - response attributes: {dir(response)}")
        if hasattr(response, '__dict__'):
            log_info(f"Profile query - response.__dict__: {response.__dict__}")
    
    if response is None:
        error_detail = f"Supabase returned None for profile query. user_id: {user_id}, user_keys: {list(user.keys())}"
        log_error(error_detail)
        raise HTTPException(status_code=500, detail=error_detail)
    
    if hasattr(response, 'error') and response.error:
        error = response.error
        error_message = getattr(error, 'message', str(error)) if error else str(error)
        error_code = getattr(error, 'code', None) if hasattr(error, 'code') else None
        error_hint = getattr(error, 'hint', None) if hasattr(error, 'hint') else None
        
        log_error(f"Supabase error in profile query:")
        log_error(f"  - Error message: {error_message}")
        log_error(f"  - Error code: {error_code}")
        log_error(f"  - Error hint: {error_hint}")
        log_error(f"  - Full error object: {error}")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Supabase error: {error_message} (code: {error_code}, hint: {error_hint})"
        )
    
    if not hasattr(response, 'data') or not response.data:
        log_warning(f"Profile query - response.data is missing or None")
        log_warning(f"Profile query - hasattr(response, 'data'): {hasattr(response, 'data')}")
        if hasattr(response, 'data'):
            log_warning(f"Profile query - response.data value: {response.data}")
        
        error_detail = f"Profile not found for user_id: {user_id}. Response type: {type(response)}, has_data_attr: {hasattr(response, 'data')}"
        if hasattr(response, 'data'):
            error_detail += f", data_value: {response.data}"
        log_error(error_detail)
        raise HTTPException(status_code=404, detail=error_detail)
    
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

class UpdateProfileRequest(BaseModel):
    full_name: str
    mobile: Optional[str] = None

class UpdateProfileResponse(BaseModel):
    success: Optional[bool] = None
    error: Optional[str] = None

class AddStudentRequest(BaseModel):
    sectionId: str
    schoolYear: str
    studentIdentifier: str
    fullName: str

class AddStudentResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    full_name: str
    mobile: Optional[str] = None

class UpdateProfileResponse(BaseModel):
    success: Optional[bool] = None
    error: Optional[str] = None

class AddStudentRequest(BaseModel):
    sectionId: str
    schoolYear: str
    studentIdentifier: str
    fullName: str

class AddStudentResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class BulkStudentItem(BaseModel):
    studentIdentifier: str
    fullName: str

class BulkAddStudentsRequest(BaseModel):
    sectionId: str
    schoolYear: str
    students: list[BulkStudentItem]

class BulkAddStudentsResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class UpdateStudentRequest(BaseModel):
    studentId: str
    studentIdentifier: str
    fullName: str
    sectionId: str

class UpdateStudentResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    mobile: Optional[str] = None
    grade: Optional[str] = None
    section: Optional[str] = None
    room_number: Optional[str] = None
    role: str  # "teacher" or "admin"

class SignupResponse(BaseModel):
    success: Optional[bool] = None
    error: Optional[str] = None

class AdminResetPasswordRequest(BaseModel):
    email: str
    new_password: str

class AdminResetPasswordResponse(BaseModel):
    success: Optional[bool] = None
    error: Optional[str] = None

class ApproveUserRequest(BaseModel):
    profileId: str
    role: str  # "teacher" or "admin"

class ApproveUserResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class ToggleUserActiveRequest(BaseModel):
    profileId: str
    isActive: bool

class ToggleUserActiveResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class UpdateUserRoleRequest(BaseModel):
    profileId: str
    role: str  # "teacher" or "admin"

class UpdateUserRoleResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: str
    role: str
    grade: Optional[str] = None
    section: Optional[str] = None
    mobile: Optional[str] = None
    is_active: bool
    is_approved: bool
    created_at: str

class UsersListResponse(BaseModel):
    users: list[UserResponse]

class SectionResponse(BaseModel):
    id: str
    grade: str
    section: str

class SectionsListResponse(BaseModel):
    sections: list[SectionResponse]

class AttendanceEntryResponse(BaseModel):
    student_name: str
    student_identifier: Optional[int] = None
    status: str
    comments: Optional[str] = None

class AttendanceListResponse(BaseModel):
    entries: list[AttendanceEntryResponse]
    statistics: dict

class ArchiveSettingsResponse(BaseModel):
    current_school_year: str
    archive_status: str
    archive_path: Optional[str] = None

class PrepareArchiveResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class PurgeArchiveRequest(BaseModel):
    confirmed: bool

class PurgeArchiveResponse(BaseModel):
    success: Optional[str] = None
    error: Optional[str] = None

class DownloadLinkResponse(BaseModel):
    label: str
    url: str

class DownloadLinksResponse(BaseModel):
    links: list[DownloadLinkResponse]

# Routes
# Root endpoint (without /api prefix for health checks)
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "ITA Attendance API"}

# API routes with /api prefix (mounted on api_router)
@api_router.get("/")
async def api_root():
    """API health check endpoint"""
    return {"status": "ok", "service": "ITA Attendance API"}

@api_router.get("/test")
async def test():
    """Test endpoint to verify Python backend is accessible"""
    return {"status": "Python is alive", "message": "Backend connection successful"}

@api_router.get("/debug/env")
async def debug_env():
    """Debug endpoint to check environment variables (without sensitive values)"""
    return {
        "supabase_url_set": bool(SUPABASE_URL),
        "supabase_anon_key_set": bool(SUPABASE_ANON_KEY),
        "supabase_service_role_key_set": bool(SUPABASE_SERVICE_ROLE_KEY),
        "supabase_jwt_secret_set": bool(SUPABASE_JWT_SECRET),
        "supabase_url": SUPABASE_URL[:20] + "..." if SUPABASE_URL else None,
    }

@api_router.post("/attendance", response_model=AttendanceResponse)
async def save_attendance(
    payload: SaveAttendanceRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Save attendance records
    Migrated from TypeScript saveAttendance Server Action
    """
    try:
        logger.info(f"save_attendance called with payload: sectionId={payload.sectionId}, date={payload.attendanceDate}, entries={len(payload.entries)}")
        
        # Check daily cutoff - COMMENTED OUT FOR TESTING
        # if is_after_daily_cutoff(datetime.now(timezone.utc)):
        #     return JSONResponse(
        #         status_code=400,
        #         content={"error": "Attendance is locked after 3:00 PM PT."}
        #     )
        
        logger.info("Initializing Supabase clients...")
        
        # Extract access token from Authorization header for RLS
        access_token = None
        if authorization:
            try:
                scheme, token = authorization.split()
                if scheme.lower() == "bearer":
                    access_token = token
            except ValueError:
                pass
        
        # Use authenticated client for RLS policies
        supabase = get_supabase_client(access_token=access_token)
        admin_supabase = get_supabase_admin_client()
        logger.info("Supabase clients initialized successfully")
        
        # Check if date is a holiday
        # Use admin client directly since holidays are public data and we want to avoid RLS issues
        log_info("Checking for holidays...")
        log_info(f"Holiday query - school_year: {payload.schoolYear}, date: {payload.attendanceDate}")
        log_info(f"Using admin client for holiday query (bypasses RLS)")
        
        # Use admin client directly (bypasses RLS)
        try:
            holiday_response = admin_supabase.table("holidays").select("holiday_date").eq(
                "school_year", payload.schoolYear
            ).eq("holiday_date", payload.attendanceDate).maybe_single().execute()
            
            log_info(f"Holiday query - response type: {type(holiday_response)}")
            log_info(f"Holiday query - response: {holiday_response}")
            if holiday_response is not None:
                log_info(f"Holiday query - hasattr(response, 'data'): {hasattr(holiday_response, 'data')}")
                if hasattr(holiday_response, 'data'):
                    log_info(f"Holiday query - response.data: {holiday_response.data}")
                log_info(f"Holiday query - hasattr(response, 'error'): {hasattr(holiday_response, 'error')}")
                if hasattr(holiday_response, 'error'):
                    log_info(f"Holiday query - response.error: {holiday_response.error}")
        except Exception as e:
            log_error(f"Exception during holiday query: {str(e)}")
            log_error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Exception during holiday query: {str(e)}")
        
        if holiday_response is None:
            error_detail = f"Supabase returned None for holiday query even with admin client. This might mean the query failed or the table doesn't exist."
            log_error(error_detail)
            # Don't fail - just log and continue (holiday check is optional)
            log_warning("Continuing without holiday check - assuming date is not a holiday")
            holiday_response = type('obj', (object,), {'data': None})()  # Create empty response object
        
        if hasattr(holiday_response, 'error') and holiday_response.error:
            error = holiday_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            error_code = getattr(error, 'code', None) if hasattr(error, 'code') else None
            error_hint = getattr(error, 'hint', None) if hasattr(error, 'hint') else None
            
            log_error(f"Supabase error in holiday query:")
            log_error(f"  - Error message: {error_message}")
            log_error(f"  - Error code: {error_code}")
            log_error(f"  - Error hint: {error_hint}")
            log_error(f"  - Full error object: {error}")
            
            raise HTTPException(
                status_code=500,
                detail=f"Supabase error: {error_message} (code: {error_code}, hint: {error_hint})"
            )
        
        if hasattr(holiday_response, 'data') and holiday_response.data:
            return JSONResponse(
                status_code=400,
                content={"error": "This date is marked as a holiday."}
            )
        
        # Get student data
        logger.info("Fetching student data...")
        student_ids = [entry.studentId for entry in payload.entries]
        logger.info(f"Student IDs to fetch: {student_ids}")
        students_response = supabase.table("students").select(
            "id,student_identifier,section_id"
        ).in_("id", student_ids).execute()
        
        if students_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for students query")
        
        if hasattr(students_response, 'error') and students_response.error:
            log_error(f"Supabase error in students query: {students_response.error}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {students_response.error}")
        
        if not hasattr(students_response, 'data'):
            raise HTTPException(status_code=500, detail="Supabase response missing data attribute")
        
        logger.info(f"Found {len(students_response.data or [])} students")
        
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
        logger.info(f"Upserting {len(upserts)} attendance records...")
        attendance_response = admin_supabase.table("attendance").upsert(
            upserts,
            on_conflict="student_id,attendance_date"
        ).execute()
        
        if attendance_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for attendance upsert")
        
        if hasattr(attendance_response, 'error') and attendance_response.error:
            log_error(f"Supabase error in attendance upsert: {attendance_response.error}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {attendance_response.error}")
        
        if not hasattr(attendance_response, 'data'):
            raise HTTPException(status_code=500, detail="Supabase response missing data attribute")
        
        logger.info(f"Upsert response: {attendance_response.data is not None}")
        
        if attendance_response.data is None:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to save attendance"}
            )
        
        logger.info("Attendance saved successfully")
        return {"success": "Attendance saved."}
    except Exception as e:
        log_error(f"Error saving attendance: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to save attendance: {str(e)}"}
        )

@api_router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Update user profile
    Migrated from TypeScript updateProfile Server Action
    """
    try:
        log_info(f"update_profile called for user_id: {profile.get('id')}")
        
        # Validation: full name is required
        if not payload.full_name or not payload.full_name.strip():
            return JSONResponse(
                status_code=400,
                content={"error": "Full name is required and cannot be empty."}
            )
        
        # Capitalize the name
        capitalized_name = capitalize_name(payload.full_name.strip())
        
        # Build update object - only update editable fields
        update_data = {
            "full_name": capitalized_name,
            "mobile": payload.mobile.strip() if payload.mobile else None
        }
        
        log_info(f"Updating profile with data: {update_data}")
        
        # Use admin client to update profile
        admin_supabase = get_supabase_admin_client()
        response = admin_supabase.table("profiles").update(update_data).eq("id", profile["id"]).execute()
        
        if response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for profile update")
        
        if hasattr(response, 'error') and response.error:
            error = response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error in profile update: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to update profile: {error_message}")
        
        log_info("Profile updated successfully")
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error updating profile: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update profile: {str(e)}"}
        )

@api_router.post("/students", response_model=AddStudentResponse)
async def add_student(
    payload: AddStudentRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Add a single student to a section
    Migrated from TypeScript addStudent Server Action
    """
    try:
        log_info(f"add_student called - sectionId: {payload.sectionId}, studentIdentifier: {payload.studentIdentifier}, fullName: {payload.fullName}")
        
        if not payload.sectionId:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing section for this class."}
            )
        
        # Validate student identifier is a number
        try:
            student_identifier = int(payload.studentIdentifier)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"error": "Student ID must be a number."}
            )
        
        admin_supabase = get_supabase_admin_client()
        
        # Get section to verify it exists and get school_year
        section_response = admin_supabase.table("sections").select("school_year").eq("id", payload.sectionId).maybe_single().execute()
        
        if section_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for section query")
        
        if hasattr(section_response, 'error') and section_response.error:
            error = section_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        
        if not hasattr(section_response, 'data') or not section_response.data:
            return JSONResponse(
                status_code=404,
                content={"error": "Section not found."}
            )
        
        section = section_response.data
        school_year = section.get("school_year") or payload.schoolYear
        
        # Check if student_identifier already exists globally
        log_info(f"Checking for existing student with identifier: {student_identifier}")
        existing_response = admin_supabase.table("students").select(
            "id,full_name,section_id,sections(grade,section)"
        ).eq("student_identifier", student_identifier).maybe_single().execute()
        
        log_info(f"Existing student check - response type: {type(existing_response)}")
        log_info(f"Existing student check - response: {existing_response}")
        
        # Handle response - check for errors first
        if existing_response is None:
            log_warning("Supabase returned None for existing student check, assuming no existing student.")
            # Treat None as "no student found" - proceed with insert
        elif hasattr(existing_response, 'error') and existing_response.error:
            error = existing_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error in existing student check: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        elif hasattr(existing_response, 'data'):
            log_info(f"Existing student check - has data: {existing_response.data is not None}")
            if existing_response.data is not None:
                # Student already exists - return error
                existing = existing_response.data
                section_info = existing.get("sections")
                if isinstance(section_info, list) and len(section_info) > 0:
                    section_info = section_info[0]
                elif not section_info:
                    section_info = None
                
                if section_info:
                    section_display = f"Grade {section_info.get('grade')} {section_info.get('section')}"
                else:
                    section_display = "another class"
                
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": f"Student ID {student_identifier} already exists for {existing.get('full_name')} in {section_display}. Each student ID must be unique across all classes."
                    }
                )
        
        # Insert new student
        capitalized_name = capitalize_name(payload.fullName)
        insert_data = {
            "student_identifier": student_identifier,
            "full_name": capitalized_name,
            "section_id": payload.sectionId,
            "school_year": school_year
        }
        
        log_info(f"Inserting student: {insert_data}")
        
        # Insert student - Supabase returns the inserted row(s) by default
        # Note: .select() cannot be chained after .insert() in Supabase Python client
        inserted_response = admin_supabase.table("students").insert(insert_data).execute()
        
        if inserted_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for student insert")
        
        if hasattr(inserted_response, 'error') and inserted_response.error:
            error = inserted_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            raise HTTPException(status_code=500, detail=f"Failed to add student: {error_message}")
        
        if not hasattr(inserted_response, 'data') or not inserted_response.data:
            return JSONResponse(
                status_code=500,
                content={"error": "Unable to add student."}
            )
        
        inserted = inserted_response.data
        if isinstance(inserted, list) and len(inserted) > 0:
            student_id = inserted[0].get("id")
        elif isinstance(inserted, dict):
            student_id = inserted.get("id")
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Unable to add student."}
            )
        
        # Backfill attendance for existing dates in this section
        # Get all unique attendance dates for this section
        attendance_dates_response = admin_supabase.table("attendance").select("attendance_date").eq("section_id", payload.sectionId).execute()
        
        if attendance_dates_response and hasattr(attendance_dates_response, 'data') and attendance_dates_response.data:
            unique_dates = list(set([row.get("attendance_date") for row in attendance_dates_response.data if row.get("attendance_date")]))
            
            if unique_dates:
                # Get holidays for this school year
                holidays_response = admin_supabase.table("holidays").select("holiday_date").eq("school_year", school_year).in_("holiday_date", unique_dates).execute()
                
                holiday_dates = set()
                if holidays_response and hasattr(holidays_response, 'data') and holidays_response.data:
                    holiday_dates = set([row.get("holiday_date") for row in holidays_response.data if row.get("holiday_date")])
                
                # Create backfill attendance records (absent for all non-holiday dates)
                backfill = [
                    {
                        "student_id": student_id,
                        "student_identifier": student_identifier,
                        "section_id": payload.sectionId,
                        "recorded_by": profile["id"],
                        "attendance_date": date,
                        "status": "absent",
                        "comments": None,
                        "school_year": school_year,
                    }
                    for date in unique_dates if date not in holiday_dates
                ]
                
                if backfill:
                    log_info(f"Backfilling attendance for {len(backfill)} dates")
                    backfill_response = admin_supabase.table("attendance").upsert(
                        backfill,
                        on_conflict="student_id,attendance_date"
                    ).execute()
                    
                    if backfill_response and hasattr(backfill_response, 'error') and backfill_response.error:
                        log_warning(f"Warning: Failed to backfill attendance: {backfill_response.error}")
        
        log_info("Student added successfully")
        return {"success": "Student added."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error adding student: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to add student: {str(e)}"}
        )

@api_router.put("/students", response_model=UpdateStudentResponse)
async def update_student(
    payload: UpdateStudentRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Update an existing student
    Migrated from TypeScript updateStudent Server Action
    """
    try:
        log_info(f"update_student called - studentId: {payload.studentId}, studentIdentifier: {payload.studentIdentifier}, fullName: {payload.fullName}")
        
        # Validate student identifier is a number
        try:
            student_identifier = int(payload.studentIdentifier)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"error": "Student ID must be a number."}
            )
        
        admin_supabase = get_supabase_admin_client()
        
        # Check if the new student_identifier already exists for a different student globally
        existing_response = admin_supabase.table("students").select(
            "id,full_name,section_id,sections(grade,section)"
        ).eq("student_identifier", student_identifier).neq("id", payload.studentId).maybe_single().execute()
        
        if existing_response is None:
            log_warning("Supabase returned None for existing student check during update, assuming no conflict.")
        elif hasattr(existing_response, 'error') and existing_response.error:
            error = existing_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error in existing student check: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        elif hasattr(existing_response, 'data') and existing_response.data is not None:
            # Student ID already exists for another student
            existing = existing_response.data
            section_info = existing.get("sections")
            if isinstance(section_info, list) and len(section_info) > 0:
                section_info = section_info[0]
            elif not section_info:
                section_info = None
            
            if section_info:
                section_display = f"Grade {section_info.get('grade')} {section_info.get('section')}"
            else:
                section_display = "another class"
            
            return JSONResponse(
                status_code=400,
                content={
                    "error": f"Student ID {student_identifier} already exists for {existing.get('full_name')} in {section_display}. Each student ID must be unique across all classes."
                }
            )
        
        # Update student
        capitalized_name = capitalize_name(payload.fullName.strip())
        update_data = {
            "student_identifier": student_identifier,
            "full_name": capitalized_name,
        }
        
        log_info(f"Updating student: {update_data}")
        
        update_response = admin_supabase.table("students").update(update_data).eq("id", payload.studentId).execute()
        
        if update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for student update")
        
        if hasattr(update_response, 'error') and update_response.error:
            error = update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating student: {error_message}")
            raise HTTPException(status_code=500, detail=f"Unable to update student: {error_message}")
        
        # Also update student_identifier in attendance records
        attendance_update_response = admin_supabase.table("attendance").update(
            {"student_identifier": student_identifier}
        ).eq("student_id", payload.studentId).execute()
        
        if attendance_update_response and hasattr(attendance_update_response, 'error') and attendance_update_response.error:
            log_warning(f"Warning: Failed to update student_identifier in attendance records: {attendance_update_response.error}")
            # Don't fail the whole operation if attendance update fails
        
        log_info("Student updated successfully")
        return {"success": "Student updated."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error updating student: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update student: {str(e)}"}
        )

@api_router.post("/students/bulk", response_model=BulkAddStudentsResponse)
async def bulk_add_students(
    payload: BulkAddStudentsRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Add multiple students from CSV upload
    Migrated from TypeScript addStudentsFromCsv Server Action
    """
    try:
        log_info(f"bulk_add_students called - sectionId: {payload.sectionId}, studentCount: {len(payload.students)}")
        
        if not payload.sectionId:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing section for this class."}
            )
        
        admin_supabase = get_supabase_admin_client()
        
        # Get section to verify it exists and get school_year
        section_response = admin_supabase.table("sections").select("school_year").eq("id", payload.sectionId).maybe_single().execute()
        
        if section_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for section query")
        if hasattr(section_response, 'error') and section_response.error:
            error = section_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        if not hasattr(section_response, 'data') or not section_response.data:
            return JSONResponse(
                status_code=404,
                content={"error": "Section not found."}
            )
        
        section = section_response.data
        school_year = section.get("school_year") or payload.schoolYear
        
        # Process and validate student records
        records = []
        for student in payload.students:
            try:
                student_identifier = int(student.studentIdentifier.strip())
                if not isinstance(student_identifier, int):
                    continue  # Skip invalid IDs
            except (ValueError, AttributeError):
                continue  # Skip non-numeric IDs
            
            full_name = student.fullName.strip()
            if not full_name:
                continue  # Skip empty names
            
            records.append({
                "student_identifier": student_identifier,
                "full_name": capitalize_name(full_name),
                "section_id": payload.sectionId,
                "school_year": school_year,
            })
        
        if len(records) == 0:
            return JSONResponse(
                status_code=400,
                content={"error": "No valid student rows found in CSV."}
            )
        
        # Check for duplicate student_identifiers in the CSV itself
        identifier_counts = {}
        for record in records:
            student_id = record.get("student_identifier")
            if student_id:
                identifier_counts[student_id] = identifier_counts.get(student_id, 0) + 1
        
        duplicates_in_csv = [student_id for student_id, count in identifier_counts.items() if count > 1]
        if duplicates_in_csv:
            return JSONResponse(
                status_code=400,
                content={"error": f"Duplicate student IDs found in CSV: {', '.join(map(str, duplicates_in_csv))}. Each student ID must be unique."}
            )
        
        # Check for existing student_identifiers in the database globally
        identifiers_to_check = [r.get("student_identifier") for r in records if r.get("student_identifier")]
        
        if identifiers_to_check:
            existing_response = admin_supabase.table("students").select(
                "student_identifier,full_name,section_id,sections(grade,section)"
            ).in_("student_identifier", identifiers_to_check).execute()
            
            if existing_response is None:
                raise HTTPException(status_code=500, detail="Supabase returned None for existing students query")
            if hasattr(existing_response, 'error') and existing_response.error:
                error = existing_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_error(f"Supabase error checking existing students: {error_message}")
                raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
            
            existing_students = existing_response.data if hasattr(existing_response, 'data') else []
            
            if existing_students:
                duplicates = []
                for s in existing_students:
                    section_info = s.get("sections")
                    if isinstance(section_info, list) and len(section_info) > 0:
                        section_info = section_info[0]
                    elif not section_info:
                        section_info = None
                    
                    if section_info:
                        section_display = f"Grade {section_info.get('grade')} {section_info.get('section')}"
                    else:
                        section_display = "another class"
                    
                    duplicates.append(f"ID {s.get('student_identifier')} ({s.get('full_name')} - {section_display})")
                
                return JSONResponse(
                    status_code=400,
                    content={"error": f"The following student IDs already exist: {', '.join(duplicates)}. Each student ID must be unique across all classes. Please remove them from the CSV or use different student IDs."}
                )
        
        # Insert students
        insert_response = admin_supabase.table("students").insert(records).select("id,full_name,student_identifier").execute()
        
        if insert_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for students insert")
        if hasattr(insert_response, 'error') and insert_response.error:
            error = insert_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error inserting students: {error_message}")
            raise HTTPException(status_code=500, detail=f"Unable to upload roster: {error_message}")
        
        inserted_students = insert_response.data if hasattr(insert_response, 'data') else []
        
        # Backfill attendance records for existing dates
        attendance_dates_response = admin_supabase.table("attendance").select(
            "attendance_date,students!inner(section_id)"
        ).eq("students.section_id", payload.sectionId).execute()
        
        if attendance_dates_response is None:
            log_warning("Supabase returned None for attendance dates query, skipping backfill")
        elif hasattr(attendance_dates_response, 'error') and attendance_dates_response.error:
            log_warning(f"Warning: Error fetching attendance dates: {attendance_dates_response.error}")
        else:
            attendance_dates_data = attendance_dates_response.data if hasattr(attendance_dates_response, 'data') else []
            unique_dates = list(set([row.get("attendance_date") for row in attendance_dates_data if row.get("attendance_date")]))
            
            if unique_dates:
                # Get holidays
                holidays_response = admin_supabase.table("holidays").select("holiday_date").eq("school_year", school_year).in_("holiday_date", unique_dates).execute()
                
                holiday_set = set()
                if holidays_response and hasattr(holidays_response, 'data') and holidays_response.data:
                    holiday_set = set([row.get("holiday_date") for row in holidays_response.data if row.get("holiday_date")])
                
                eligible_dates = [date for date in unique_dates if date not in holiday_set]
                
                if eligible_dates and inserted_students:
                    backfill_records = []
                    for student in inserted_students:
                        student_id = student.get("id")
                        student_identifier = student.get("student_identifier")
                        
                        if not student_id or not student_identifier:
                            log_warning(f"Warning: Student {student.get('full_name')} missing id or student_identifier, skipping backfill")
                            continue
                        
                        for date in eligible_dates:
                            backfill_records.append({
                                "student_id": student_id,
                                "student_identifier": student_identifier,
                                "section_id": payload.sectionId,
                                "recorded_by": profile.get("id"),
                                "attendance_date": date,
                                "status": "absent",
                                "comments": None,
                                "school_year": school_year,
                            })
                    
                    if backfill_records:
                        backfill_response = admin_supabase.table("attendance").upsert(
                            backfill_records,
                            on_conflict="student_id,attendance_date"
                        ).execute()
                        
                        if backfill_response and hasattr(backfill_response, 'error') and backfill_response.error:
                            log_warning(f"Warning: Error backfilling attendance: {backfill_response.error}")
        
        log_info(f"Bulk add students successful: {len(inserted_students)} students added")
        return {"success": "Student roster uploaded."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in bulk_add_students: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to upload roster: {str(e)}"}
        )

@api_router.post("/auth/signup", response_model=SignupResponse)
async def signup(payload: SignupRequest):
    """
    User signup endpoint
    Migrated from TypeScript signUpWithPassword Server Action
    
    Note: For security, passwords are handled by Supabase Auth client-side.
    This endpoint creates the user via Supabase Admin API and then creates the profile.
    """
    try:
        log_info(f"signup called - email: {payload.email}, role: {payload.role}")
        
        # Normalize role
        normalized_role = "admin" if payload.role == "admin" else "teacher"
        
        # Validation
        if not payload.email or not payload.password or not payload.full_name:
            return JSONResponse(
                status_code=400,
                content={"error": "Please provide your name, email, and password."}
            )
        
        if normalized_role == "teacher" and (not payload.grade or not payload.section or not payload.room_number):
            return JSONResponse(
                status_code=400,
                content={"error": "Grade, section, and room number are required for teachers."}
            )
        
        # Normalize email
        email = payload.email.strip().lower()
        
        # Get admin client for checking existing users and creating profile
        admin_supabase = get_supabase_admin_client()
        
        # Check if user already exists
        existing_response = admin_supabase.table("profiles").select("id,is_active").eq("email", email).maybe_single().execute()
        
        if existing_response is None:
            log_warning("Supabase returned None for existing user check, assuming no existing user.")
        elif hasattr(existing_response, 'error') and existing_response.error:
            error = existing_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error checking existing user: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        elif hasattr(existing_response, 'data') and existing_response.data is not None:
            existing = existing_response.data
            if existing.get("is_active"):
                return JSONResponse(
                    status_code=400,
                    content={"error": "Your email already exists. If you forgot your password, please reset it."}
                )
            else:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Your profile has been deactivated. Please contact the admin."}
                )
        
        # Get current school year
        settings_response = admin_supabase.table("system_settings").select("current_school_year").eq("id", 1).execute()
        
        if settings_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
        if hasattr(settings_response, 'error') and settings_response.error:
            error = settings_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        if not hasattr(settings_response, 'data') or not settings_response.data:
            raise HTTPException(status_code=500, detail="Supabase response missing data for settings")
        
        settings_data = settings_response.data
        if isinstance(settings_data, list) and len(settings_data) > 0:
            current_school_year = settings_data[0].get("current_school_year", "2025-2026")
        elif isinstance(settings_data, dict):
            current_school_year = settings_data.get("current_school_year", "2025-2026")
        else:
            current_school_year = "2025-2026"
        
        # For teachers, validate section/room number
        if normalized_role == "teacher":
            grade = payload.grade.strip()
            section = payload.section.strip()
            room_number = payload.room_number.strip()
            
            # Check if section exists
            section_response = admin_supabase.table("sections").select("id,room_number").eq("grade", grade).eq("section", section).eq("school_year", current_school_year).maybe_single().execute()
            
            if section_response is None:
                log_warning("Supabase returned None for section check, assuming section doesn't exist.")
            elif hasattr(section_response, 'error') and section_response.error:
                error = section_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_error(f"Supabase error checking section: {error_message}")
                raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
            elif hasattr(section_response, 'data') and section_response.data is not None:
                existing_section = section_response.data
                existing_room = existing_section.get("room_number")
                if existing_room and room_number and existing_room != room_number:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Please check the room number for the selected grade and section."}
                    )
        
        # Create user in Supabase Auth using Admin API
        SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(status_code=500, detail="Supabase configuration missing")
        
        # Create user via Supabase Admin API
        auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        user_data = {
            "email": email,
            "password": payload.password,
            "email_confirm": True,  # Auto-confirm email for now
            "user_metadata": {
                "full_name": capitalize_name(payload.full_name.strip())
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(auth_url, json=user_data, headers=headers, timeout=30.0)
            
            if response.status_code not in [200, 201]:
                error_text = response.text
                log_error(f"Failed to create user in Supabase Auth: {response.status_code} - {error_text}")
                
                # Handle duplicate email error
                if "already registered" in error_text.lower() or "user already exists" in error_text.lower() or "email address is already" in error_text.lower():
                    return JSONResponse(
                        status_code=400,
                        content={"error": "This email address is already registered. If you forgot your password, please use the 'Forgot Password' link to reset it."}
                    )
                
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Failed to create user: {error_text}"}
                )
            
            user_result = response.json()
            user_id = user_result.get("id")
            
            if not user_id:
                return JSONResponse(
                    status_code=500,
                    content={"error": "User created but no user ID returned"}
                )
        
        # Create profile record
        capitalized_name = capitalize_name(payload.full_name.strip())
        profile_data = {
            "id": user_id,
            "email": email,
            "full_name": capitalized_name,
            "mobile": payload.mobile.strip() if payload.mobile else None,
            "grade": payload.grade.strip() if payload.grade else None,
            "section": payload.section.strip() if payload.section else None,
            "room_number": payload.room_number.strip() if payload.room_number else None,
            "role": normalized_role,
            "is_active": False,
            "is_approved": False,
        }
        
        log_info(f"Creating profile: {profile_data}")
        
        profile_response = admin_supabase.table("profiles").insert(profile_data).execute()
        
        if profile_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for profile insert")
        if hasattr(profile_response, 'error') and profile_response.error:
            error = profile_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error creating profile: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to create profile: {error_message}")
        
        log_info("User signup successful")
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in signup: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to sign up: {str(e)}"}
        )

@api_router.post("/admin/reset-password", response_model=AdminResetPasswordResponse)
async def admin_reset_password(
    payload: AdminResetPasswordRequest,
    profile: dict = Depends(get_current_profile)
):
    """
    Admin-only endpoint to reset a user's password
    This is a backup solution when password reset links don't work
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can reset passwords")
        
        log_info(f"Admin password reset requested by {profile.get('email')} for {payload.email}")
        
        # Validate input
        if not payload.email or not payload.new_password:
            return JSONResponse(
                status_code=400,
                content={"error": "Email and new password are required."}
            )
        
        if len(payload.new_password) < 6:
            return JSONResponse(
                status_code=400,
                content={"error": "Password must be at least 6 characters long."}
            )
        
        email = payload.email.strip().lower()
        
        # Get admin client
        admin_supabase = get_supabase_admin_client()
        
        # Find user by email in profiles table
        profile_response = admin_supabase.table("profiles").select("id").eq("email", email).maybe_single().execute()
        
        if profile_response is None:
            return JSONResponse(
                status_code=404,
                content={"error": "User not found."}
            )
        
        if hasattr(profile_response, 'error') and profile_response.error:
            error = profile_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error finding user: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
        
        if not hasattr(profile_response, 'data') or not profile_response.data:
            return JSONResponse(
                status_code=404,
                content={"error": "User not found."}
            )
        
        user_id = profile_response.data.get("id")
        if not user_id:
            return JSONResponse(
                status_code=404,
                content={"error": "User ID not found."}
            )
        
        # Reset password using Supabase Admin API
        SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(status_code=500, detail="Supabase configuration missing")
        
        # Update user password via Admin API
        auth_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        user_data = {
            "password": payload.new_password,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.put(auth_url, json=user_data, headers=headers, timeout=30.0)
            
            if response.status_code not in [200, 201]:
                error_text = response.text
                log_error(f"Failed to reset password: {response.status_code} - {error_text}")
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Failed to reset password: {error_text}"}
                )
        
        log_info(f"Password reset successful for {email}")
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in admin_reset_password: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to reset password: {str(e)}"}
        )

@api_router.post("/admin/users/approve", response_model=ApproveUserResponse)
async def approve_user(
    payload: ApproveUserRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Approve a user and assign them a role (teacher or admin)
    Migrated from TypeScript approveUserAsRole Server Action
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can approve users")
        
        # Check if trying to approve self
        if profile.get("id") == payload.profileId:
            return JSONResponse(
                status_code=400,
                content={"error": "Cannot approve yourself."}
            )
        
        log_info(f"Admin {profile.get('email')} approving user {payload.profileId} as {payload.role}")
        
        # Normalize role
        normalized_role = "admin" if payload.role == "admin" else "teacher"
        
        admin_supabase = get_supabase_admin_client()
        
        # If approving as teacher, validate and create section/teacher_sections
        if normalized_role == "teacher":
            # Get teacher profile to check grade/section
            teacher_response = admin_supabase.table("profiles").select("grade,section,room_number").eq("id", payload.profileId).maybe_single().execute()
            
            if teacher_response is None:
                raise HTTPException(status_code=404, detail="User not found")
            if hasattr(teacher_response, 'error') and teacher_response.error:
                error = teacher_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_error(f"Supabase error fetching teacher: {error_message}")
                raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
            if not hasattr(teacher_response, 'data') or not teacher_response.data:
                raise HTTPException(status_code=404, detail="User not found")
            
            teacher = teacher_response.data
            grade = teacher.get("grade")
            section = teacher.get("section")
            room_number = teacher.get("room_number")
            
            if not grade or not section or not room_number:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Teacher grade/section is missing."}
                )
            
            # Get current school year
            settings_response = admin_supabase.table("system_settings").select("current_school_year").eq("id", 1).execute()
            
            if settings_response is None:
                raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
            if hasattr(settings_response, 'error') and settings_response.error:
                error = settings_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_error(f"Supabase error fetching settings: {error_message}")
                raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
            if not hasattr(settings_response, 'data') or not settings_response.data:
                raise HTTPException(status_code=500, detail="Supabase response missing data for settings")
            
            settings_data = settings_response.data
            if isinstance(settings_data, list) and len(settings_data) > 0:
                current_school_year = settings_data[0].get("current_school_year", "2025-2026")
            elif isinstance(settings_data, dict):
                current_school_year = settings_data.get("current_school_year", "2025-2026")
            else:
                current_school_year = "2025-2026"
            
            # Check if section exists
            section_response = admin_supabase.table("sections").select("id,room_number").eq("grade", grade).eq("section", section).eq("school_year", current_school_year).maybe_single().execute()
            
            section_id = None
            if section_response is None:
                log_warning("Section not found, creating new section")
            elif hasattr(section_response, 'error') and section_response.error:
                error = section_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_error(f"Supabase error checking section: {error_message}")
                raise HTTPException(status_code=500, detail=f"Supabase error: {error_message}")
            elif hasattr(section_response, 'data') and section_response.data is not None:
                existing_section = section_response.data
                existing_room = existing_section.get("room_number")
                if existing_room and room_number and existing_room != room_number:
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Room number mismatch for this grade and section. Please verify."}
                    )
                section_id = existing_section.get("id")
            
            # Create section if it doesn't exist
            if not section_id:
                insert_section_response = admin_supabase.table("sections").insert({
                    "grade": grade,
                    "section": section,
                    "room_number": room_number,
                    "school_year": current_school_year,
                }).execute()
                
                if insert_section_response is None:
                    raise HTTPException(status_code=500, detail="Supabase returned None for section insert")
                if hasattr(insert_section_response, 'error') and insert_section_response.error:
                    error = insert_section_response.error
                    error_message = getattr(error, 'message', str(error)) if error else str(error)
                    log_error(f"Supabase error creating section: {error_message}")
                    raise HTTPException(status_code=500, detail=f"Failed to create section: {error_message}")
                
                section_data = insert_section_response.data
                if isinstance(section_data, list) and len(section_data) > 0:
                    section_id = section_data[0].get("id")
                elif isinstance(section_data, dict):
                    section_id = section_data.get("id")
            
            if not section_id:
                return JSONResponse(
                    status_code=500,
                    content={"error": "Unable to create section for this teacher."}
                )
            
            # Create teacher_sections entry
            teacher_sections_response = admin_supabase.table("teacher_sections").upsert(
                {
                    "teacher_id": payload.profileId,
                    "section_id": section_id,
                },
                {
                    "on_conflict": "teacher_id,section_id"
                }
            ).execute()
            
            if teacher_sections_response is None:
                log_warning("Supabase returned None for teacher_sections upsert, but proceeding")
            elif hasattr(teacher_sections_response, 'error') and teacher_sections_response.error:
                error = teacher_sections_response.error
                error_message = getattr(error, 'message', str(error)) if error else str(error)
                log_warning(f"Warning: Supabase error upserting teacher_sections: {error_message}")
        
        # Update profile: approve, activate, and set role
        update_data = {
            "is_approved": True,
            "is_active": True,
            "role": normalized_role,
        }
        
        log_info(f"Updating profile {payload.profileId} with: {update_data}")
        
        profile_update_response = admin_supabase.table("profiles").update(update_data).eq("id", payload.profileId).execute()
        
        if profile_update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for profile update")
        if hasattr(profile_update_response, 'error') and profile_update_response.error:
            error = profile_update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating profile: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to approve user: {error_message}")
        
        log_info(f"User {payload.profileId} approved successfully as {normalized_role}")
        return {"success": "User approved."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in approve_user: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to approve user: {str(e)}"}
        )

@api_router.post("/admin/users/toggle-active", response_model=ToggleUserActiveResponse)
async def toggle_user_active(
    payload: ToggleUserActiveRequest,
    profile: dict = Depends(get_current_profile)
):
    """
    Toggle a user's active status (activate/deactivate)
    Migrated from TypeScript toggleUserActiveStatus Server Action
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can toggle user status")
        
        # Check if trying to change own status
        if profile.get("id") == payload.profileId:
            return JSONResponse(
                status_code=400,
                content={"error": "Cannot change your own status."}
            )
        
        log_info(f"Admin {profile.get('email')} toggling user {payload.profileId} active status to {payload.isActive}")
        
        admin_supabase = get_supabase_admin_client()
        
        update_response = admin_supabase.table("profiles").update({"is_active": payload.isActive}).eq("id", payload.profileId).execute()
        
        if update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for profile update")
        if hasattr(update_response, 'error') and update_response.error:
            error = update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating profile: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to update user status: {error_message}")
        
        log_info(f"User {payload.profileId} active status updated to {payload.isActive}")
        return {"success": "Status updated."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in toggle_user_active: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update user status: {str(e)}"}
        )

@api_router.post("/admin/users/update-role", response_model=UpdateUserRoleResponse)
async def update_user_role(
    payload: UpdateUserRoleRequest,
    profile: dict = Depends(get_current_profile)
):
    """
    Update a user's role (teacher or admin)
    Migrated from TypeScript updateUserRole Server Action
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can update user roles")
        
        # Check if trying to change own role
        if profile.get("id") == payload.profileId:
            return JSONResponse(
                status_code=400,
                content={"error": "Cannot change your own role."}
            )
        
        # Validate role
        if payload.role not in ["teacher", "admin"]:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid role. Must be 'teacher' or 'admin'."}
            )
        
        log_info(f"Admin {profile.get('email')} updating user {payload.profileId} role to {payload.role}")
        
        admin_supabase = get_supabase_admin_client()
        
        update_response = admin_supabase.table("profiles").update({"role": payload.role}).eq("id", payload.profileId).execute()
        
        if update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for profile update")
        if hasattr(update_response, 'error') and update_response.error:
            error = update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating profile: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to update user role: {error_message}")
        
        log_info(f"User {payload.profileId} role updated to {payload.role}")
        return {"success": "Role updated."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in update_user_role: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update user role: {str(e)}"}
        )

@api_router.get("/admin/users", response_model=UsersListResponse)
async def get_all_users(
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Get all users (admin only)
    This endpoint uses the admin client to bypass RLS and fetch all profiles
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can view all users")
        
        log_info(f"Admin {profile.get('email')} fetching all users")
        
        admin_supabase = get_supabase_admin_client()
        
        # Fetch all profiles
        response = admin_supabase.table("profiles").select(
            "id,full_name,email,role,grade,section,mobile,is_active,is_approved,created_at"
        ).order("created_at", desc=True).execute()
        
        if response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for users query")
        if hasattr(response, 'error') and response.error:
            error = response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching users: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch users: {error_message}")
        
        users_data = response.data if hasattr(response, 'data') else []
        
        # Convert to response model
        users = [
            UserResponse(
                id=user.get("id"),
                full_name=user.get("full_name"),
                email=user.get("email", ""),
                role=user.get("role", "teacher"),
                grade=user.get("grade"),
                section=user.get("section"),
                mobile=user.get("mobile"),
                is_active=user.get("is_active", False),
                is_approved=user.get("is_approved", False),
                created_at=user.get("created_at", ""),
            )
            for user in users_data
        ]
        
        log_info(f"Returning {len(users)} users")
        return {"users": users}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in get_all_users: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch users: {str(e)}"}
        )

@api_router.get("/admin/sections", response_model=SectionsListResponse)
async def get_all_sections(
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Get all sections (admin only)
    This endpoint uses the admin client to bypass RLS and fetch all sections
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can view all sections")
        
        log_info(f"Admin {profile.get('email')} fetching all sections")
        
        admin_supabase = get_supabase_admin_client()
        
        # Fetch all sections, ordered by grade
        response = admin_supabase.table("sections").select(
            "id,grade,section"
        ).order("grade", desc=False).execute()
        
        if response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for sections query")
        if hasattr(response, 'error') and response.error:
            error = response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching sections: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch sections: {error_message}")
        
        sections_data = response.data if hasattr(response, 'data') else []
        
        # Convert to response model
        sections = [
            SectionResponse(
                id=section.get("id"),
                grade=section.get("grade", ""),
                section=section.get("section", ""),
            )
            for section in sections_data
        ]
        
        log_info(f"Returning {len(sections)} sections")
        return {"sections": sections}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in get_all_sections: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch sections: {str(e)}"}
        )

@api_router.get("/admin/attendance", response_model=AttendanceListResponse)
async def get_attendance_for_section(
    section_id: str,
    date: str,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Get attendance for a specific section and date (admin only)
    This endpoint uses the admin client to bypass RLS
    """
    try:
        # Check if current user is admin
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can view attendance")
        
        log_info(f"Admin {profile.get('email')} fetching attendance for section {section_id} on {date}")
        
        admin_supabase = get_supabase_admin_client()
        
        # Fetch attendance with student details
        response = admin_supabase.table("attendance").select(
            "status,comments,students!inner(full_name,student_identifier)"
        ).eq("attendance_date", date).eq("section_id", section_id).execute()
        
        if response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for attendance query")
        if hasattr(response, 'error') and response.error:
            error = response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching attendance: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch attendance: {error_message}")
        
        attendance_data = response.data if hasattr(response, 'data') else []
        
        # Convert to response model
        entries = []
        statistics = {
            "present": 0,
            "absent": 0,
            "late": 0,
            "left_early": 0,
        }
        
        for entry in attendance_data:
            student = entry.get("students")
            if isinstance(student, list) and len(student) > 0:
                student = student[0]
            elif not student:
                continue
            
            status = entry.get("status", "")
            entries.append(
                AttendanceEntryResponse(
                    student_name=student.get("full_name", "Unknown"),
                    student_identifier=student.get("student_identifier"),
                    status=status,
                    comments=entry.get("comments"),
                )
            )
            
            # Update statistics
            if status in statistics:
                statistics[status] = statistics.get(status, 0) + 1
        
        log_info(f"Returning {len(entries)} attendance entries")
        return {
            "entries": entries,
            "statistics": statistics,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in get_attendance_for_section: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch attendance: {str(e)}"}
        )

@api_router.get("/admin/archive/settings", response_model=ArchiveSettingsResponse)
async def get_archive_settings(
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Get archive settings (admin only)
    """
    try:
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can view archive settings")
        
        admin_supabase = get_supabase_admin_client()
        
        response = admin_supabase.table("system_settings").select(
            "current_school_year,archive_status,archive_path"
        ).eq("id", 1).maybe_single().execute()
        
        if response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
        if hasattr(response, 'error') and response.error:
            error = response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {error_message}")
        
        settings_data = response.data if hasattr(response, 'data') else {}
        
        return ArchiveSettingsResponse(
            current_school_year=settings_data.get("current_school_year", ""),
            archive_status=settings_data.get("archive_status", "IDLE"),
            archive_path=settings_data.get("archive_path"),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in get_archive_settings: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch archive settings: {str(e)}"}
        )

@api_router.post("/admin/archive/prepare", response_model=PrepareArchiveResponse)
async def prepare_archive(
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Prepare archive by exporting students and attendance to CSV and uploading to storage (admin only)
    """
    try:
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can prepare archives")
        
        log_info(f"Admin {profile.get('email')} preparing archive")
        
        admin_supabase = get_supabase_admin_client()
        
        # Get system settings
        settings_response = admin_supabase.table("system_settings").select(
            "current_school_year,archive_status"
        ).eq("id", 1).maybe_single().execute()
        
        if settings_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
        if hasattr(settings_response, 'error') and settings_response.error:
            error = settings_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {error_message}")
        
        settings_data = settings_response.data if hasattr(settings_response, 'data') else {}
        
        if not settings_data:
            return JSONResponse(
                status_code=400,
                content={"error": "System settings not found."}
            )
        
        if settings_data.get("archive_status") != "IDLE":
            return JSONResponse(
                status_code=400,
                content={"error": "Archive preparation already in progress."}
            )
        
        school_year = settings_data.get("current_school_year")
        
        # Fetch students
        students_response = admin_supabase.table("students").select(
            "id,full_name,section_id,school_year"
        ).eq("school_year", school_year).execute()
        
        if students_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for students query")
        if hasattr(students_response, 'error') and students_response.error:
            error = students_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching students: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch students: {error_message}")
        
        students_data = students_response.data if hasattr(students_response, 'data') else []
        
        # Fetch attendance
        attendance_response = admin_supabase.table("attendance").select(
            "attendance_date,status,comments,school_year,students(full_name,section_id)"
        ).eq("school_year", school_year).execute()
        
        if attendance_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for attendance query")
        if hasattr(attendance_response, 'error') and attendance_response.error:
            error = attendance_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching attendance: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch attendance: {error_message}")
        
        attendance_data = attendance_response.data if hasattr(attendance_response, 'data') else []
        
        # Convert to CSV
        def to_csv(data):
            if not data:
                return ""
            output = io.StringIO()
            if isinstance(data, list) and len(data) > 0:
                writer = csv.DictWriter(output, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
            return output.getvalue()
        
        # Process attendance data
        attendance_rows = []
        for row in attendance_data:
            student = row.get("students")
            if isinstance(student, list) and len(student) > 0:
                student = student[0]
            elif not student:
                student = {}
            
            attendance_rows.append({
                "attendance_date": row.get("attendance_date", ""),
                "status": row.get("status", ""),
                "comments": row.get("comments") or "",
                "school_year": row.get("school_year", ""),
                "student_name": student.get("full_name", ""),
                "section_id": student.get("section_id", ""),
            })
        
        students_csv = to_csv(students_data)
        attendance_csv = to_csv(attendance_rows)
        
        # Upload to storage
        base_path = f"staging/{school_year}"
        
        students_upload = admin_supabase.storage.from_("ITA_attendance_archives").upload(
            f"{base_path}/students.csv",
            students_csv.encode('utf-8'),
            file_options={"content-type": "text/csv", "upsert": True}
        )
        
        if hasattr(students_upload, 'error') and students_upload.error:
            error = students_upload.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error uploading students CSV: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to upload students CSV: {error_message}")
        
        attendance_upload = admin_supabase.storage.from_("ITA_attendance_archives").upload(
            f"{base_path}/attendance.csv",
            attendance_csv.encode('utf-8'),
            file_options={"content-type": "text/csv", "upsert": True}
        )
        
        if hasattr(attendance_upload, 'error') and attendance_upload.error:
            error = attendance_upload.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error uploading attendance CSV: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to upload attendance CSV: {error_message}")
        
        # Update system settings
        update_response = admin_supabase.table("system_settings").update({
            "archive_status": "ARCHIVE_READY",
            "archive_path": base_path
        }).eq("id", 1).execute()
        
        if update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings update")
        if hasattr(update_response, 'error') and update_response.error:
            error = update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to update settings: {error_message}")
        
        log_info("Archive prepared successfully")
        return {"success": "Archive prepared."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in prepare_archive: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to prepare archive: {str(e)}"}
        )

@api_router.post("/admin/archive/purge", response_model=PurgeArchiveResponse)
async def purge_archive(
    payload: PurgeArchiveRequest,
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Purge database for current school year (admin only)
    """
    try:
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can purge archives")
        
        if not payload.confirmed:
            return JSONResponse(
                status_code=400,
                content={"error": "Please verify the data before purging."}
            )
        
        log_info(f"Admin {profile.get('email')} purging archive")
        
        admin_supabase = get_supabase_admin_client()
        
        # Get system settings
        settings_response = admin_supabase.table("system_settings").select(
            "current_school_year,archive_status"
        ).eq("id", 1).maybe_single().execute()
        
        if settings_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
        if hasattr(settings_response, 'error') and settings_response.error:
            error = settings_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {error_message}")
        
        settings_data = settings_response.data if hasattr(settings_response, 'data') else {}
        
        if not settings_data or settings_data.get("archive_status") != "ARCHIVE_READY":
            return JSONResponse(
                status_code=400,
                content={"error": "Archive is not ready for purge."}
            )
        
        school_year = settings_data.get("current_school_year")
        
        # Update status to PURGING
        update_status_response = admin_supabase.table("system_settings").update({
            "archive_status": "PURGING"
        }).eq("id", 1).execute()
        
        if update_status_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for status update")
        if hasattr(update_status_response, 'error') and update_status_response.error:
            error = update_status_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error updating status: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to update status: {error_message}")
        
        # Delete data
        delete_attendance_response = admin_supabase.table("attendance").delete().eq("school_year", school_year).execute()
        if hasattr(delete_attendance_response, 'error') and delete_attendance_response.error:
            log_warning(f"Warning: Error deleting attendance: {delete_attendance_response.error}")
        
        delete_students_response = admin_supabase.table("students").delete().eq("school_year", school_year).execute()
        if hasattr(delete_students_response, 'error') and delete_students_response.error:
            log_warning(f"Warning: Error deleting students: {delete_students_response.error}")
        
        delete_sections_response = admin_supabase.table("sections").delete().eq("school_year", school_year).execute()
        if hasattr(delete_sections_response, 'error') and delete_sections_response.error:
            log_warning(f"Warning: Error deleting sections: {delete_sections_response.error}")
        
        # Update status back to IDLE
        final_update_response = admin_supabase.table("system_settings").update({
            "archive_status": "IDLE",
            "archive_path": None
        }).eq("id", 1).execute()
        
        if final_update_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for final update")
        if hasattr(final_update_response, 'error') and final_update_response.error:
            error = final_update_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error final update: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to finalize purge: {error_message}")
        
        log_info("Archive purged successfully")
        return {"success": "Database purged for current school year."}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in purge_archive: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to purge archive: {str(e)}"}
        )

@api_router.get("/admin/archive/download-urls", response_model=DownloadLinksResponse)
async def get_download_urls(
    profile: dict = Depends(get_current_profile),
    authorization: Optional[str] = Header(None)
):
    """
    Get signed URLs for archive download links (admin only)
    """
    try:
        if profile.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can get download URLs")
        
        admin_supabase = get_supabase_admin_client()
        
        # Get system settings
        settings_response = admin_supabase.table("system_settings").select(
            "archive_status,archive_path"
        ).eq("id", 1).maybe_single().execute()
        
        if settings_response is None:
            raise HTTPException(status_code=500, detail="Supabase returned None for settings query")
        if hasattr(settings_response, 'error') and settings_response.error:
            error = settings_response.error
            error_message = getattr(error, 'message', str(error)) if error else str(error)
            log_error(f"Supabase error fetching settings: {error_message}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {error_message}")
        
        settings_data = settings_response.data if hasattr(settings_response, 'data') else {}
        
        links = []
        
        if settings_data.get("archive_status") == "ARCHIVE_READY" and settings_data.get("archive_path"):
            archive_path = settings_data.get("archive_path")
            
            # Get signed URLs
            students_url_response = admin_supabase.storage.from_("ITA_attendance_archives").create_signed_url(
                f"{archive_path}/students.csv",
                3600
            )
            
            attendance_url_response = admin_supabase.storage.from_("ITA_attendance_archives").create_signed_url(
                f"{archive_path}/attendance.csv",
                3600
            )
            
            if hasattr(students_url_response, 'signed_url') and students_url_response.signed_url:
                links.append(DownloadLinkResponse(label="Students CSV", url=students_url_response.signed_url))
            elif hasattr(students_url_response, 'data') and students_url_response.data and students_url_response.data.get("signedUrl"):
                links.append(DownloadLinkResponse(label="Students CSV", url=students_url_response.data["signedUrl"]))
            
            if hasattr(attendance_url_response, 'signed_url') and attendance_url_response.signed_url:
                links.append(DownloadLinkResponse(label="Attendance CSV", url=attendance_url_response.signed_url))
            elif hasattr(attendance_url_response, 'data') and attendance_url_response.data and attendance_url_response.data.get("signedUrl"):
                links.append(DownloadLinkResponse(label="Attendance CSV", url=attendance_url_response.data["signedUrl"]))
        
        return {"links": links}
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(f"Error in get_download_urls: {str(e)}")
        log_error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get download URLs: {str(e)}"}
        )

# Mount the API router to the app
app.include_router(api_router)

# Local development: Run with uvicorn directly
# Vercel deployment: Auto-detected by Vercel
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002, reload=True)

# Vercel FastAPI Auto-Detection
# Vercel automatically detects FastAPI apps by looking for 'app' variable at module level
# No custom handler needed - Vercel handles FastAPI routing automatically
# The 'app' variable defined above is what Vercel uses for routing

