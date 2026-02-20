#!/usr/bin/env python3
"""
Standalone script to reset a user's password using Supabase Admin API
This script uses the service role key to directly update passwords without email flow.

Usage:
    python scripts/reset_password.py <email> <new_password>

Example:
    python scripts/reset_password.py shoppingbuddy8@gmail.com MyNewPassword123
"""

import sys
import os
from pathlib import Path
import httpx

# Load environment variables from .env.local
try:
    from dotenv import load_dotenv
    script_dir = Path(__file__).parent.parent
    env_file = script_dir / ".env.local"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
        print(f"✅ Loaded .env.local from {env_file}")
    else:
        print(f"⚠️  .env.local not found at {env_file}")
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment variables")

def reset_password(email: str, new_password: str):
    """Reset a user's password using Supabase Admin API"""
    
    SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL:
        print("❌ Error: VITE_SUPABASE_URL or SUPABASE_URL not found in environment")
        print("   Make sure .env.local exists and contains VITE_SUPABASE_URL")
        return False
    
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment")
        print("   Make sure .env.local exists and contains SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    if not email or not new_password:
        print("❌ Error: Email and password are required")
        return False
    
    if len(new_password) < 6:
        print("❌ Error: Password must be at least 6 characters long")
        return False
    
    email = email.strip().lower()
    
    print(f"\n🔄 Resetting password for: {email}")
    print(f"   New password length: {len(new_password)} characters")
    
    # Step 1: Find user by email
    print("\n📋 Step 1: Finding user by email...")
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            # List users and filter by email
            response = client.get(auth_url, headers=headers)
            
            if response.status_code != 200:
                print(f"❌ Error fetching users: {response.status_code} - {response.text}")
                return False
            
            users = response.json()
            
            # Find user with matching email
            user = None
            for u in users.get("users", []):
                if u.get("email", "").lower() == email:
                    user = u
                    break
            
            if not user:
                print(f"❌ User not found: {email}")
                print("   Available users:")
                for u in users.get("users", [])[:5]:  # Show first 5
                    print(f"     - {u.get('email', 'N/A')}")
                return False
            
            user_id = user.get("id")
            if not user_id:
                print("❌ User ID not found")
                return False
            
            print(f"✅ Found user: {user.get('email')} (ID: {user_id})")
            
            # Step 2: Update password
            print("\n🔐 Step 2: Updating password...")
            update_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
            update_data = {
                "password": new_password,
            }
            
            update_response = client.put(update_url, headers=headers, json=update_data)
            
            if update_response.status_code in [200, 201]:
                print(f"✅ Password reset successful!")
                print(f"\n📧 User {email} can now log in with the new password.")
                return True
            else:
                print(f"❌ Error updating password: {update_response.status_code}")
                print(f"   Response: {update_response.text}")
                return False
                
    except httpx.RequestError as e:
        print(f"❌ Network error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python scripts/reset_password.py <email> <new_password>")
        print("\nExample:")
        print("  python scripts/reset_password.py shoppingbuddy8@gmail.com MyNewPassword123")
        sys.exit(1)
    
    email = sys.argv[1]
    new_password = sys.argv[2]
    
    success = reset_password(email, new_password)
    sys.exit(0 if success else 1)


