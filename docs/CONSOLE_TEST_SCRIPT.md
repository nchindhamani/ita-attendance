# Console Test Script for Python API

## Simple Test Script (No Supabase Client Needed)

Since `supabase` is not available in the console, use this script that gets the token from cookies:

### Step 1: Test Health Check

```javascript
// Simple health check - no authentication needed
fetch('/api/')
  .then(res => res.json())
  .then(data => {
    console.log('✅ Health Check Success:', data);
  })
  .catch(err => {
    console.error('❌ Health Check Error:', err);
  });
```

### Step 2: Get JWT Token from Cookies

```javascript
// Get Supabase auth token from cookies
function getAuthToken() {
  // Supabase stores the token in cookies with a pattern like: sb-<project-id>-auth-token
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name.includes('auth-token')) {
      try {
        // The cookie value is URL encoded JSON
        const decoded = decodeURIComponent(value);
        const tokenData = JSON.parse(decoded);
        // The access_token is what we need
        return tokenData.access_token || tokenData;
      } catch (e) {
        // If it's not JSON, it might be the token directly
        return value;
      }
    }
  }
  
  // Alternative: Try to find any cookie with 'token' in the name
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name.toLowerCase().includes('token') || name.toLowerCase().includes('auth')) {
      console.log('Found cookie:', name);
      return value;
    }
  }
  
  return null;
}

const token = getAuthToken();
console.log('Token found:', token ? 'Yes' : 'No');
if (token) {
  console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
}
```

### Step 3: Complete Test Script (All-in-One)

Copy this entire script into the console:

```javascript
(async () => {
  console.log('=== Testing Python API ===\n');
  
  // 1. Health Check
  try {
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch('/api/');
    const healthData = await healthResponse.json();
    console.log('✅ Health Check:', healthData);
  } catch (error) {
    console.error('❌ Health Check Failed:', error);
    return;
  }
  
  // 2. Get Token from Cookies
  console.log('\n2️⃣ Getting Auth Token...');
  function getTokenFromCookies() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      // Supabase cookie pattern
      if (name.includes('auth-token') || name.includes('sb-')) {
        try {
          const decoded = decodeURIComponent(value);
          const parsed = JSON.parse(decoded);
          return parsed.access_token || parsed;
        } catch {
          return value;
        }
      }
    }
    return null;
  }
  
  const token = getTokenFromCookies();
  
  if (!token) {
    console.error('❌ No token found. Make sure you are logged in.');
    console.log('💡 Tip: Try refreshing the page and logging in again.');
    return;
  }
  
  console.log('✅ Token found:', token.substring(0, 30) + '...');
  
  // 3. Get Section and Student IDs from current page
  console.log('\n3️⃣ Getting test data from current page...');
  
  // Try to get section ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sectionId = urlParams.get('section');
  
  if (!sectionId) {
    console.error('❌ No section ID in URL. Please navigate to an attendance page first.');
    return;
  }
  
  console.log('✅ Section ID:', sectionId);
  
  // 4. Test Attendance Endpoint
  console.log('\n4️⃣ Testing Attendance Endpoint...');
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  
  // For testing, we'll use a minimal payload
  // You'll need to replace studentId with an actual student ID
  const testPayload = {
    sectionId: sectionId,
    attendanceDate: today,
    schoolYear: '2025-2026',
    entries: [
      {
        studentId: 'REPLACE_WITH_ACTUAL_STUDENT_ID', // You need to get this
        status: 'present',
        comments: 'Test from Python API'
      }
    ]
  };
  
  console.log('📤 Sending request:', {
    ...testPayload,
    entries: testPayload.entries.map(e => ({ ...e, studentId: e.studentId.substring(0, 8) + '...' }))
  });
  
  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Attendance API Success:', result);
    } else {
      console.error('❌ Attendance API Error:', result);
      console.log('Status:', response.status);
    }
  } catch (error) {
    console.error('❌ Request Failed:', error);
  }
})();
```

### Step 4: Get Student ID from Page

To get an actual student ID, run this first:

```javascript
// Get student IDs from the current page
// This looks for student data in the page
const getStudentIds = () => {
  // Check if there's any data in window or React components
  // Look for student elements in the DOM
  const studentRows = document.querySelectorAll('[data-student-id], [id*="student"]');
  const ids = [];
  
  studentRows.forEach(row => {
    const id = row.getAttribute('data-student-id') || 
               row.getAttribute('id') ||
               row.dataset.id;
    if (id) ids.push(id);
  });
  
  // Alternative: Check localStorage or sessionStorage
  try {
    const stored = localStorage.getItem('students') || sessionStorage.getItem('students');
    if (stored) {
      const students = JSON.parse(stored);
      return students.map(s => s.id);
    }
  } catch {}
  
  return ids;
};

console.log('Student IDs found:', getStudentIds());
```

### Step 5: Complete Working Script

Here's the complete script that gets everything from the page:

```javascript
(async () => {
  console.clear();
  console.log('🚀 Python API Test\n');
  
  // 1. Health Check
  try {
    const health = await fetch('/api/').then(r => r.json());
    console.log('✅ Health Check:', health);
  } catch (e) {
    console.error('❌ Health Check Failed');
    return;
  }
  
  // 2. Get Token
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});
  
  let token = null;
  for (const [name, value] of Object.entries(cookies)) {
    if (name.includes('auth') || name.includes('sb-')) {
      try {
        const parsed = JSON.parse(decodeURIComponent(value));
        token = parsed.access_token || parsed.token || value;
        break;
      } catch {
        token = value;
        break;
      }
    }
  }
  
  if (!token) {
    console.error('❌ No auth token found. Please log in.');
    return;
  }
  
  console.log('✅ Token found');
  
  // 3. Get Section ID from URL
  const sectionId = new URLSearchParams(window.location.search).get('section');
  if (!sectionId) {
    console.error('❌ No section in URL. Go to an attendance page.');
    return;
  }
  
  console.log('✅ Section ID:', sectionId);
  
  // 4. Get Student ID - Try to extract from page or use a test
  // Since we can't easily get it, we'll make a request that will fail gracefully
  console.log('\n📝 Note: You need a valid student ID to test attendance.');
  console.log('💡 Get it from your database or use the student ID from the attendance page.');
  
  // For now, just test the endpoint structure
  console.log('\n✅ Ready to test! Use this format:');
  console.log(`
fetch('/api/attendance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${token.substring(0, 20)}...'
  },
  body: JSON.stringify({
    sectionId: '${sectionId}',
    attendanceDate: '${new Date().toISOString().split('T')[0]}',
    schoolYear: '2025-2026',
    entries: [{
      studentId: 'YOUR_STUDENT_ID_HERE',
      status: 'present',
      comments: null
    }]
  })
}).then(r => r.json()).then(console.log);
  `);
})();
```

## Alternative: Use Network Tab

Instead of console, you can:

1. **Open Network Tab** in DevTools
2. **Click "Save attendance"** button in your app
3. **Look for the request** to `/api/attendance` (if frontend is updated) or the Server Action
4. **Copy the request** and modify it to test the Python endpoint

## Quick Fix: Test with Minimal Script

Just test if the endpoint is accessible:

```javascript
// Minimal test - just check if endpoint exists
fetch('/api/attendance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token'
  },
  body: JSON.stringify({})
})
  .then(res => {
    console.log('Status:', res.status);
    return res.json();
  })
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Error:', err));
```

This will at least tell you if the endpoint is reachable (you'll get a 401 or 400, which is expected).


