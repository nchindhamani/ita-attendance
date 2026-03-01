#!/usr/bin/env python3
"""
Script to assign a teacher to a section.
This will create an entry in the teacher_sections table.

Usage:
    python scripts/assign_teacher_to_section.py <teacher_id_or_email> <section_id>

Example:
    python scripts/assign_teacher_to_section.py teacher@example.com <section-uuid>
    python scripts/assign_teacher_to_section.py 7ede9e47-2490-446d-8286-64cff64114ee <section-uuid>
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
        # Get user from profiles
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

def find_section_by_grade_and_section(grade: str, section: str, school_year: str = "2025-2026"):
    """Find section by grade and section name"""
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/sections?grade=eq.{grade}&section=eq.{section}&school_year=eq.{school_year}&select=id,grade,section"
    response = httpx.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        if data:
            return data[0]
    return None

def assign_teacher_to_section(teacher_id: str, section_id: str):
    """Assign teacher to section"""
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/teacher_sections"
    payload = {
        "teacher_id": teacher_id,
        "section_id": section_id
    }
    
    response = httpx.post(url, json=payload, headers=headers)
    
    if response.status_code in [200, 201]:
        print(f"✅ Teacher assigned to section successfully!")
        return True
    else:
        print(f"❌ Failed to assign teacher: {response.status_code} - {response.text}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/assign_teacher_to_section.py <teacher_id_or_email> [section_id]")
        print("\nIf section_id is not provided, the script will try to find the section")
        print("based on the teacher's grade and section from their profile.")
        print("\nExample:")
        print("  python scripts/assign_teacher_to_section.py teacher@example.com")
        print("  python scripts/assign_teacher_to_section.py 7ede9e47-2490-446d-8286-64cff64114ee <section-uuid>")
        sys.exit(1)
    
    identifier = sys.argv[1].strip()
    section_id = sys.argv[2].strip() if len(sys.argv) > 2 else None
    
    print(f"🔍 Looking up teacher: {identifier}")
    
    # Find teacher
    teacher = find_user_by_email_or_id(identifier)
    
    if not teacher:
        print(f"❌ Teacher not found: {identifier}")
        print("   Make sure you're using the correct user ID (UUID) or email address")
        sys.exit(1)
    
    teacher_id = teacher.get('id')
    teacher_name = teacher.get('full_name', 'Unknown')
    teacher_email = teacher.get('email', 'No email')
    teacher_grade = teacher.get('grade')
    teacher_section = teacher.get('section')
    
    print(f"\n📋 Teacher Information:")
    print(f"   Name: {teacher_name}")
    print(f"   Email: {teacher_email}")
    print(f"   Grade: {teacher_grade}")
    print(f"   Section: {teacher_section}")
    
    # Find section if not provided
    if not section_id:
        if not teacher_grade or not teacher_section:
            print("\n❌ Cannot find section: Teacher profile is missing grade or section information")
            print("   Please provide section_id manually:")
            print(f"   python scripts/assign_teacher_to_section.py {identifier} <section-uuid>")
            sys.exit(1)
        
        print(f"\n🔍 Looking for section: Grade {teacher_grade}, Section {teacher_section}")
        section = find_section_by_grade_and_section(teacher_grade, teacher_section)
        
        if not section:
            print(f"\n❌ Section not found: Grade {teacher_grade}, Section {teacher_section}")
            print("   Please create the section first or provide section_id manually")
            sys.exit(1)
        
        section_id = section.get('id')
        print(f"✅ Found section: {section_id}")
    
    # Assign teacher to section
    print(f"\n🔗 Assigning teacher to section...")
    success = assign_teacher_to_section(teacher_id, section_id)
    
    if success:
        print(f"\n✅ Teacher assignment completed successfully!")
        print(f"   Teacher: {teacher_name} ({teacher_email})")
        print(f"   Section ID: {section_id}")
    else:
        print(f"\n❌ Teacher assignment failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()



