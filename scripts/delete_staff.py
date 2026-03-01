#!/usr/bin/env python3
"""
Script to delete a staff member from the database.
This will:
1. Delete the profile from profiles table
2. Delete the auth user from auth.users (cascade will handle related data)
3. Delete related records (teacher_sections, attendance records, etc.)

Usage:
    python scripts/delete_staff.py <user_id_or_email>

Example:
    python scripts/delete_staff.py 7ede9e47-2490-446d-8286-64cff64114ee
    python scripts/delete_staff.py sindhu@example.com
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load environment variables
script_dir = Path(__file__).parent.parent
env_file = script_dir / ".env.local"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: Missing Supabase credentials in environment variables")
    print("   Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local")
    sys.exit(1)

def find_user_by_email_or_id(identifier: str):
    """Find user by email or ID"""
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try as UUID first
    if len(identifier) == 36 and identifier.count('-') == 4:
        # Looks like a UUID
        user_id = identifier
        # Get user from profiles with grade and section for teachers
        url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=id,full_name,email,role,grade,section"
        response = httpx.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                return data[0]
    else:
        # Try as email
        url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{identifier}&select=id,full_name,email,role,grade,section"
        response = httpx.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                return data[0]
    
    return None

def delete_user(user_id: str, user_info: dict):
    """Delete user from both profiles and auth.users"""
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    print(f"\n🗑️  Deleting user: {user_info.get('full_name', 'Unknown')} ({user_info.get('email', 'No email')})")
    print(f"   Role: {user_info.get('role', 'Unknown')}")
    print(f"   User ID: {user_id}")
    
    # If teacher, check for section deletion before deleting user
    section_to_delete = None
    if user_info.get('role') == 'teacher':
        grade = user_info.get('grade')
        section = user_info.get('section')
        
        if grade and section:
            print(f"   Teacher assigned to: Grade {grade}, Section {section}")
            
            # Get current school year
            settings_url = f"{SUPABASE_URL}/rest/v1/system_settings?id=eq.1&select=current_school_year"
            settings_response = httpx.get(settings_url, headers=headers)
            current_school_year = "2025-2026"  # Default
            if settings_response.status_code == 200:
                settings_data = settings_response.json()
                if settings_data:
                    current_school_year = settings_data[0].get('current_school_year', '2025-2026')
            
            # Find the section ID
            section_url = f"{SUPABASE_URL}/rest/v1/sections?grade=eq.{grade}&section=eq.{section}&school_year=eq.{current_school_year}&select=id"
            section_response = httpx.get(section_url, headers=headers)
            
            if section_response.status_code == 200:
                section_data = section_response.json()
                if section_data:
                    section_id = section_data[0].get('id')
                    
                    # Check if there are other teachers assigned to this section
                    teacher_sections_url = f"{SUPABASE_URL}/rest/v1/teacher_sections?section_id=eq.{section_id}&select=teacher_id"
                    ts_response = httpx.get(teacher_sections_url, headers=headers)
                    
                    if ts_response.status_code == 200:
                        teacher_sections = ts_response.json()
                        # Filter out the current teacher
                        other_teachers = [ts for ts in teacher_sections if ts.get('teacher_id') != user_id]
                        
                        if not other_teachers:
                            print(f"   ℹ️  No other teachers assigned to this section")
                            print(f"   📝 Will delete section: Grade {grade}, Section {section}")
                            section_to_delete = section_id
                        else:
                            print(f"   ℹ️  {len(other_teachers)} other teacher(s) assigned to this section - keeping section")
    
    # First, clear foreign key references in attendance records
    print("   Clearing attendance record references...")
    
    # Clear recorded_by in student_attendance
    student_attendance_url = f"{SUPABASE_URL}/rest/v1/student_attendance?recorded_by=eq.{user_id}"
    patch_data = {"recorded_by": None}
    response = httpx.patch(student_attendance_url, json=patch_data, headers=headers)
    if response.status_code in [200, 204]:
        print("   ✅ Cleared student_attendance references")
    else:
        print(f"   ⚠️  Warning: Could not clear student_attendance references: {response.status_code}")
    
    # Clear recorded_by in teacher_attendance (if column exists)
    teacher_attendance_url = f"{SUPABASE_URL}/rest/v1/teacher_attendance?recorded_by=eq.{user_id}"
    response = httpx.patch(teacher_attendance_url, json=patch_data, headers=headers)
    if response.status_code in [200, 204]:
        print("   ✅ Cleared teacher_attendance references")
    elif response.status_code != 404:  # 404 means table/column doesn't exist, which is fine
        print(f"   ⚠️  Warning: Could not clear teacher_attendance references: {response.status_code}")
    
    # Delete from auth.users (this will cascade delete from profiles due to foreign key)
    print("   Deleting from auth.users...")
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    response = httpx.delete(auth_url, headers=headers)
    
    if response.status_code in [200, 204]:
        print("✅ User deleted successfully from auth.users")
        print("   (Profile and related data deleted automatically via cascade)")
        
        # Delete section if no other teachers were assigned
        if section_to_delete:
            print(f"   Deleting section (ID: {section_to_delete})...")
            delete_section_url = f"{SUPABASE_URL}/rest/v1/sections?id=eq.{section_to_delete}"
            delete_response = httpx.delete(delete_section_url, headers=headers)
            if delete_response.status_code in [200, 204]:
                print(f"   ✅ Section deleted successfully")
            else:
                print(f"   ⚠️  Warning: Could not delete section: {delete_response.status_code} - {delete_response.text}")
        
        return True
    else:
        print(f"❌ Failed to delete user: {response.status_code} - {response.text}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/delete_staff.py <user_id_or_email> [--force]")
        print("\nExample:")
        print("  python scripts/delete_staff.py 7ede9e47-2490-446d-8286-64cff64114ee")
        print("  python scripts/delete_staff.py sindhu@example.com --force")
        sys.exit(1)
    
    identifier = sys.argv[1].strip()
    force = len(sys.argv) > 2 and sys.argv[2] == '--force'
    
    print(f"🔍 Looking up user: {identifier}")
    
    # Find user
    user_info = find_user_by_email_or_id(identifier)
    
    if not user_info:
        print(f"❌ User not found: {identifier}")
        print("   Make sure you're using the correct user ID (UUID) or email address")
        sys.exit(1)
    
    user_id = user_info.get('id')
    if not user_id:
        print("❌ User ID not found in response")
        sys.exit(1)
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: This will permanently delete:")
    print(f"   - User: {user_info.get('full_name', 'Unknown')}")
    print(f"   - Email: {user_info.get('email', 'No email')}")
    print(f"   - All related data (attendance records, sections, etc.)")
    
    if not force:
        try:
            confirm = input("\nType 'DELETE' to confirm: ")
            if confirm != 'DELETE':
                print("❌ Deletion cancelled")
                sys.exit(0)
        except EOFError:
            print("\n❌ Interactive input not available. Use --force flag to skip confirmation.")
            print("   Example: python scripts/delete_staff.py <user_id> --force")
            sys.exit(1)
    else:
        print("\n⚠️  --force flag used, skipping confirmation...")
    
    # Delete user
    success = delete_user(user_id, user_info)
    
    if success:
        print("\n✅ User deletion completed successfully!")
    else:
        print("\n❌ User deletion failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

