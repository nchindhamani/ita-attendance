# ITA Attendance Portal - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [For Teachers](#for-teachers)
3. [For Administrators](#for-administrators)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First-Time Access

1. **Sign Up**
   - Visit the ITA Attendance Portal homepage
   - Click "Sign Up"
   - Fill in all required fields (marked with red asterisks *):
     - **Full Name** (required)
     - **Email** (required)
     - **Password** (required)
     - **Mobile** (optional)
     - **Grade** (required for teachers)
     - **Section** (required for teachers)
     - **Room Number** (required for teachers)
   - Click "Sign Up"
   - You will be redirected to the login page

2. **Wait for Approval**
   - After signing up, your account status is "Pending Approval"
   - An administrator must approve your account before you can access the portal
   - You will see a "Pending Approval" message if you try to log in before approval
   - Once approved, you can log in normally

3. **Log In**
   - Go to the login page
   - Enter your email and password
   - Click "Sign In"
   - You will be taken to your dashboard

### Password Reset

If you forget your password:
1. Click "Forgot password?" on the login page
2. Enter your email address
3. Check your email for password reset instructions
4. Click the link in the email
5. Enter your new password

**Note:** If your account has been deactivated, you cannot reset your password. Contact an administrator.

---

## For Teachers

### Dashboard Overview

When you log in as a teacher, you'll see:
- **My Classes**: List of classes assigned to you
- **Attendance**: Take attendance for your class
- **History**: View past attendance records
- **Student Lookup**: Search for individual student attendance
- **Profile**: View and edit your profile

### My Classes Page

This page shows all classes assigned to you.

**Class Information Card:**
- Displays Grade, Section, School Year, and Room Number
- **Take attendance** button: Opens attendance page for that class
- **View history** button: Opens history page for that class

**Students Card:**
- Lists all students in the class
- Shows Student ID and Student Name
- **Edit** button: Update student ID or name
  - Click "Edit" next to a student
  - Update Student ID or Student Name
  - Click "Save Changes"

### Taking Attendance

1. Navigate to **Attendance** from the menu or click "Take attendance" on My Classes
2. Select a date (defaults to today)
3. For each student:
   - **Status**: Select Present, Absent, Late, or Left Early
   - **Comments**: Add any notes (optional)
4. Click **Save Attendance**

**Important Notes:**
- Attendance is locked after 11:00 PM PST (for testing; will be 3:00 PM PST in production)
- You cannot edit attendance after the daily cutoff
- Holidays are automatically detected - students won't be marked absent on holidays
- You can add new students while taking attendance:
  - Click "Add student" button
  - Enter Student ID and Student Name
  - Click "Add student"
  - The student will be added and marked absent for all previous dates

### Adding Students

**Method 1: Manual Entry**
1. On the Attendance page, click "Add student"
2. Enter Student ID (must be a number, unique across all classes)
3. Enter Student Name
4. Click "Add student"

**Method 2: CSV Upload**
1. On the Attendance page, prepare a CSV file with:
   - First column: Student ID (numbers only)
   - Second column: Student Name
2. Click "Choose File" under "Upload CSV"
3. Select your CSV file
4. Students will be automatically added

**Important:**
- Each Student ID must be unique across all classes
- If you try to add a duplicate Student ID, you'll see an error message showing which class already has that ID
- New students are automatically marked absent for all previous attendance dates

### Viewing Attendance History

1. Navigate to **History** from the menu
2. Select a date using the date picker
3. View attendance records for that date
4. Click **Download CSV** to export the data

### Student Lookup

1. Navigate to **Student Lookup** from the menu
2. Enter a Student ID
3. View all attendance records for that student in the current school year
4. Records show Date, Status, and Comments

### Managing Your Profile

1. Click **Profile** in the navigation menu
2. View your current information:
   - Email (read-only - cannot be changed)
   - Full Name (editable)
   - Mobile (editable)
   - Grade, Section, Room Number (editable for teachers)
   - Role (read-only)
   - Account Created date (read-only)
3. Make changes to editable fields
4. Click **Save Changes**

**Note:** Mandatory fields (marked with *) cannot be left empty.

---

## For Administrators

### Dashboard Overview

When you log in as an administrator, you'll see:
- **Admin Overview**: Statistics and quick actions
- **User Management**: Approve new users and manage existing staff
- **Attendance**: View attendance across all classes
- **Student Lookup**: Search for any student's attendance across all school years
- **Archive**: Archive and purge attendance data
- **Profile**: View and edit your profile

### Admin Overview

The overview page shows:
- Number of pending teacher approvals
- Number of active teachers
- Quick links to common tasks

### User Management

**Approval Queue Tab:**
- Shows all users waiting for approval
- For each user, you can:
  - **Approve**: Click "Approve" to activate the account
  - **Grant Teacher Access**: Toggle to give teacher permissions
  - **Grant Admin Access**: Toggle to give admin permissions
- Once approved, users move to the Staff Directory

**Staff Directory Tab:**
- Shows all approved users
- For each user, you can:
  - **View Details**: Click on the user's name to see full profile
  - **Change Role**: Use the role selector to change between Teacher and Admin
  - **Deactivate**: Toggle to deactivate an account (user cannot log in)
- **Note:** You cannot deactivate your own account

**Viewing User Details:**
- Click on any user's name in the Staff Directory
- View complete profile information including:
  - Name, Email, Mobile
  - Role, Status, Approval Status
  - Grade/Section, Room Number
  - Account creation date

### Viewing Attendance (Admin)

1. Navigate to **Attendance** from the menu
2. Select a Grade and Section from the dropdown
3. Select a date
4. View attendance records for that class and date
5. Click **Download CSV** to export

### Student Lookup (Admin)

1. Navigate to **Student Lookup** from the menu
2. Enter a Student ID
3. The system automatically fetches available school years for that student
4. Select a school year from the dropdown
5. View all attendance records for that student in the selected school year

### Archiving Data

**Important:** This is a two-stage process for data safety.

**Stage 1: Prepare Archive**
1. Navigate to **Archive** from the menu
2. Select a school year to archive
3. Click **Prepare Archive**
4. The system generates a CSV file and saves it to staging
5. Wait for the process to complete

**Stage 2: Download and Verify**
1. Download the generated CSV file
2. Verify the data is correct
3. Check the box "I have verified the data"
4. Click **Purge Database**
5. The attendance data for that school year will be permanently deleted from the database

**Warning:** Purging is irreversible. Always verify the archive file before purging.

### Managing Your Profile

Same as teachers - see "Managing Your Profile" section above.

---

## Common Tasks

### Editing Student Information

**For Teachers:**
1. Go to **My Classes**
2. Find the student in the Students card
3. Click **Edit** next to the student
4. Update Student ID or Student Name
5. Click **Save Changes**

**Important:** Student IDs must be unique. If you try to use an ID that already exists in another class, you'll see an error.

### Exporting Attendance Data

**For Teachers:**
1. Go to **History**
2. Select a date
3. Click **Download CSV**

**For Admins:**
1. Go to **Attendance**
2. Select Grade, Section, and Date
3. Click **Download CSV**

### Finding a Student's Attendance

**For Teachers:**
1. Go to **Student Lookup**
2. Enter the Student ID
3. View records for current school year only

**For Admins:**
1. Go to **Student Lookup**
2. Enter the Student ID
3. Select a school year from the dropdown
4. View all records for that school year

---

## Troubleshooting

### "Account Pending" Message

**Cause:** Your account hasn't been approved yet.

**Solution:** Wait for an administrator to approve your account. Contact ITA admin if you've been waiting for more than a few days.

### "Account Disabled" Message

**Cause:** Your account has been deactivated by an administrator.

**Solution:** Contact ITA admin to reactivate your account.

### "Attendance is locked" Message

**Cause:** You're trying to edit attendance after the daily cutoff (11:00 PM PST for testing, 3:00 PM PST in production).

**Solution:** You can only edit attendance before the cutoff time. After that, attendance is locked for the day.

### "Student ID already exists" Error

**Cause:** You're trying to add a student with an ID that's already used in another class.

**Solution:** Use a different Student ID. The error message will tell you which class already has that ID.

### "No students in this class yet" Message

**Cause:** No students have been added to your class.

**Solution:** Add students using the "Add student" button or CSV upload on the Attendance page.

### Can't See Navigation Links on Mobile

**Solution:** Click the hamburger menu (☰) icon in the top-left corner to open the mobile navigation.

### Password Reset Not Working

**Possible Causes:**
- Your account is deactivated (contact admin)
- Email hasn't arrived (check spam folder)
- Email rate limit exceeded (wait 1 hour)

**Solution:** Contact ITA admin if issues persist.

### Can't Edit My Own Profile

**Solution:** Make sure you're filling in all required fields (marked with *). Email and Role cannot be changed - contact admin if needed.

---

## Best Practices

1. **Take Attendance Daily**: Mark attendance before the daily cutoff time
2. **Add Comments**: Use comments to note reasons for absences, lateness, or early departures
3. **Verify Student IDs**: Double-check Student IDs when adding students to avoid duplicates
4. **Regular Backups**: Admins should regularly archive completed school years
5. **Keep Profile Updated**: Update your mobile number and other information in your profile
6. **Secure Passwords**: Use strong passwords and don't share them

---

## Support

For technical issues or questions:
- Contact ITA Administration
- Check this manual first for common solutions
- Provide specific error messages when reporting issues

---

**Last Updated:** January 2025
**Version:** 1.0


