# Testing Python API from Browser Console

## Step-by-Step Guide

### 1. Open Your Preview URL in Browser
```
https://ita-attendance-git-feat-b8c7de-chindhamani-nachiappans-projects.vercel.app
```

### 2. Log In to Your App
- Sign in with your credentials
- Make sure you're authenticated

### 3. Open Browser DevTools
- Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Go to the **Console** tab

### 4. Test Health Check Endpoint

Copy and paste this in the console:

```javascript
// Test health check
fetch('/api/')
  .then(res => res.json())
  .then(data => console.log('Health Check:', data))
  .catch(err => console.error('Error:', err));
```

**Expected Output:**
```
Health Check: {status: "ok", service: "ITA Attendance API"}
```

### 5. Test Attendance Endpoint

First, get your JWT token and test data:

```javascript
// Get your session token
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'
);

// Get current session
const { data: { session } } = await supabase.auth.getSession();
console.log('Token:', session?.access_token);

// Now test attendance endpoint
const testPayload = {
  sectionId: 'YOUR_SECTION_ID',  // Replace with actual section ID
  attendanceDate: '2025-01-15',
  schoolYear: '2025-2026',
  entries: [
    {
      studentId: 'YOUR_STUDENT_ID',  // Replace with actual student ID
      status: 'present',
      comments: null
    }
  ]
};

fetch('/api/attendance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`
  },
  body: JSON.stringify(testPayload)
})
  .then(res => res.json())
  .then(data => console.log('Attendance Response:', data))
  .catch(err => console.error('Error:', err));
```

### 6. Get Real Data from Your App

To get actual section and student IDs, run this in console:

```javascript
// Get sections
const { data: sections } = await supabase
  .from('sections')
  .select('id, grade, section')
  .limit(1);
console.log('Sections:', sections);

// Get students from a section
if (sections && sections.length > 0) {
  const sectionId = sections[0].id;
  const { data: students } = await supabase
    .from('students')
    .select('id, student_identifier, full_name')
    .eq('section_id', sectionId)
    .limit(5);
  console.log('Students:', students);
  
  // Use these IDs in your test
  console.log('Use sectionId:', sectionId);
  console.log('Use studentId:', students?.[0]?.id);
}
```

## Quick Test Script (All-in-One)

Copy this entire script into the browser console:

```javascript
(async () => {
  try {
    // 1. Test Health Check
    console.log('=== Testing Health Check ===');
    const healthCheck = await fetch('/api/').then(r => r.json());
    console.log('✅ Health Check:', healthCheck);
    
    // 2. Get Session
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabaseUrl = window.location.origin.includes('localhost') 
      ? 'http://localhost:3000' 
      : window.location.origin;
    
    // You'll need to get these from your app's environment
    // For now, try to get from window or use the ones from your app
    const supabase = window.supabase || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('❌ Not authenticated. Please log in first.');
      return;
    }
    
    console.log('✅ Authenticated:', session.user.email);
    
    // 3. Get test data
    const { data: sections } = await supabase
      .from('sections')
      .select('id, grade, section')
      .limit(1)
      .single();
    
    if (!sections) {
      console.error('❌ No sections found');
      return;
    }
    
    const { data: students } = await supabase
      .from('students')
      .select('id, student_identifier, full_name')
      .eq('section_id', sections.id)
      .limit(1)
      .single();
    
    if (!students) {
      console.error('❌ No students found in section');
      return;
    }
    
    console.log('✅ Test Data:', { sectionId: sections.id, studentId: students.id });
    
    // 4. Test Attendance Endpoint
    console.log('=== Testing Attendance Endpoint ===');
    const attendancePayload = {
      sectionId: sections.id,
      attendanceDate: new Date().toISOString().split('T')[0], // Today's date
      schoolYear: '2025-2026',
      entries: [{
        studentId: students.id,
        status: 'present',
        comments: 'Test from Python API'
      }]
    };
    
    const attendanceResponse = await fetch('/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(attendancePayload)
    });
    
    const attendanceResult = await attendanceResponse.json();
    console.log('✅ Attendance Response:', attendanceResult);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

## Expected Results

### Health Check Success:
```json
{
  "status": "ok",
  "service": "ITA Attendance API"
}
```

### Attendance Success:
```json
{
  "success": "Attendance saved."
}
```

### Common Errors:

**401 Unauthorized:**
```json
{
  "detail": "Authorization header missing"
}
```
→ Make sure you're logged in and token is included

**400 Bad Request:**
```json
{
  "error": "Attendance is locked after 3:00 PM PT."
}
```
→ Try testing before 3 PM PT

**403 Forbidden:**
```json
{
  "detail": "Account pending approval"
}
```
→ Make sure your account is approved and active

