import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
// PREVIOUS: useNavigate was used with the old layout; kept import commented for revert
// import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// PREVIOUS: dialog imports for Add Student modal (kept for revert)
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StudentAttendanceSearch } from '@/features/admin/StudentAttendanceSearch'
import { HSCPBulkStudentUpload } from '@/features/hscp/HSCPBulkStudentUpload'
import { toast } from 'sonner'
import { Upload, UserPlus, UserX, UserCheck, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const supabase = createSupabaseBrowserClient()

interface Student {
  id: string
  full_name: string
  student_identifier: number | null
  section_id: string | null
  school_year: string
  is_active?: boolean | null
  discontinued_at?: string | null
}

interface AttendanceRecord {
  attendance_date: string
  status: string
  comments: string | null
  section_id?: string | null
}

interface HSCPSection {
  id: string
  section: string
}

export default function HSCPOfficerStudentAttendancePage() {
  useRequireRole('hscp_officer')
  // PREVIOUS: const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const studentIdInput = searchParams.get('studentId')?.trim() || ''
  const yearInput = searchParams.get('year')?.trim() || ''
  
  const [loading, setLoading] = useState(false)
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sectionInfo, setSectionInfo] = useState<{ grade: string; section: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hscpSections, setHscpSections] = useState<HSCPSection[]>([])
  const [selectedHscpTab, setSelectedHscpTab] = useState<string>('Reading')
  const [statusPending, setStatusPending] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStudentId, setEditStudentId] = useState('')

  // Add Student form state (previously used by dialog; now used by inline section)
  // PREVIOUS: const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [availableHscpGrades, setAvailableHscpGrades] = useState<string[]>([])
  const [newStudentGrade, setNewStudentGrade] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [currentSchoolYear, setCurrentSchoolYear] = useState(getCurrentSchoolYear())

  // Derive current school year from Pacific calendar; load HSCP grades for that year
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const sy = getCurrentSchoolYear()
        setCurrentSchoolYear(sy)

        // Fetch available HSCP grades
        const { data: sectionsData } = await supabase
          .from('sections')
          .select('grade')
          .like('grade', 'HSCP-%')
          .eq('school_year', sy)
          .order('grade', { ascending: true })

        if (sectionsData) {
          const gradeSet = new Set<string>()
          sectionsData.forEach((s) => {
            if (s.grade) gradeSet.add(s.grade)
          })
          setAvailableHscpGrades(Array.from(gradeSet).sort())
        }
      } catch (err) {
        console.error('Error fetching initial data:', err)
      }
    }

    fetchInitialData()
  }, [])

  // Fetch available years when studentId is provided (only for HSCP sections)
  useEffect(() => {
    if (!studentIdInput) {
      setAvailableYears([])
      return
    }

    const fetchYears = async () => {
      const studentIdNum = Number(studentIdInput)
      if (!Number.isInteger(studentIdNum)) {
        setErrorMessage('Student ID must be a valid number.')
        setAvailableYears([])
        return
      }

      try {
        // Only fetch years for HSCP sections
        const { data: yearRows, error: yearError } = await supabase
          .from('student_attendance')
          .select('school_year, sections!inner(grade)')
          .eq('student_identifier', studentIdNum)
          .like('sections.grade', 'HSCP-%')
          .order('school_year', { ascending: false })

        if (yearError) {
          setErrorMessage(`Error fetching years: ${yearError.message}`)
          setAvailableYears([])
          return
        }

        const yearSet = new Set<string>()
        const orderedYears: string[] = []
        ;(yearRows ?? []).forEach((row) => {
          if (row.school_year && !yearSet.has(row.school_year)) {
            yearSet.add(row.school_year)
            orderedYears.push(row.school_year)
          }
        })
        setAvailableYears(orderedYears)
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
        setAvailableYears([])
      }
    }

    fetchYears()
  }, [studentIdInput])

  // Fetch student and attendance when both studentId and year are provided (only HSCP sections)
  useEffect(() => {
      if (!studentIdInput || !yearInput) {
        setStudent(null)
        setAttendance([])
        setSectionInfo(null)
        setHscpSections([])
        setSelectedHscpTab('Reading')
        return
      }

    const fetchStudentData = async () => {
      setLoading(true)
      setErrorMessage(null)
      setHscpSections([])
      setSelectedHscpTab('Reading')

      try {
        const studentIdNum = Number(studentIdInput)
        if (!Number.isInteger(studentIdNum)) {
          setErrorMessage('Student ID must be a valid number.')
          setLoading(false)
          return
        }

        // Fetch student (only if in HSCP section)
        const { data: students, error: studentError } = await supabase
          .from('students')
          .select(`
            id,
            full_name,
            student_identifier,
            section_id,
            school_year,
            is_active,
            discontinued_at,
            sections!inner(grade, section)
          `)
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .like('sections.grade', 'HSCP-%')
          .maybeSingle()

        if (studentError) {
          setErrorMessage(`Error fetching student: ${studentError.message}`)
          setLoading(false)
          return
        }

        if (!students) {
          setErrorMessage('Student not found in HSCP sections.')
          setLoading(false)
          return
        }

        const section = Array.isArray(students.sections) ? students.sections[0] : students.sections
        setStudent({
          id: students.id,
          full_name: students.full_name,
          student_identifier: students.student_identifier,
          section_id: students.section_id,
          school_year: students.school_year,
          is_active: (students as { is_active?: boolean | null }).is_active ?? true,
          discontinued_at: (students as { discontinued_at?: string | null }).discontinued_at ?? null,
        })
        setSectionInfo({ grade: section.grade, section: section.section })

        // Fetch all HSCP sections for this grade (Reading, Writing, Conversation)
        const { data: allSections, error: sectionsError } = await supabase
          .from('sections')
          .select('id,section')
          .eq('grade', section.grade)
          .eq('school_year', yearInput)
          .in('section', ['Reading', 'Writing', 'Conversation'])
          .order('section', { ascending: true })

        if (!sectionsError && allSections) {
          setHscpSections(allSections as HSCPSection[])
          // Set default tab to first section if available
          if (allSections.length > 0) {
            setSelectedHscpTab(allSections[0].section)
          }
        }

        // Fetch attendance (include section_id for filtering)
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('student_attendance')
          .select(`
            attendance_date,
            status,
            comments,
            section_id,
            sections!inner(grade)
          `)
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .like('sections.grade', 'HSCP-%')
          .order('attendance_date', { ascending: false })

        if (attendanceError) {
          setErrorMessage(`Error fetching attendance: ${attendanceError.message}`)
          setLoading(false)
          return
        }

        setAttendance((attendanceData || []).map((item: any) => ({
          attendance_date: item.attendance_date,
          status: item.status,
          comments: item.comments,
          section_id: item.section_id,
        })))
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [studentIdInput, yearInput])

  // Handle Add Student
  const handleSetActiveStatus = async (isActive: boolean) => {
    if (!student || statusPending) return
    try {
      setStatusPending(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setStatusPending(false)
        return
      }
      const response = await fetch(`/api/admin/students/${student.id}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to update student status.')
        setStatusPending(false)
        return
      }
      setStudent({
        ...student,
        is_active: isActive,
        discontinued_at: isActive ? null : new Date().toISOString(),
      })
      toast.success(data.message || (isActive ? 'Student reactivated.' : 'Student discontinued.'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setStatusPending(false)
    }
  }

  const openEditStudent = () => {
    if (!student) return
    setEditName(student.full_name || '')
    setEditStudentId(String(student.student_identifier ?? ''))
    setEditOpen(true)
  }

  const handleSaveStudentEdit = async () => {
    if (!student || editSaving) return
    const name = editName.trim()
    const idRaw = editStudentId.trim()
    if (!name) {
      toast.error('Student name is required.')
      return
    }
    if (!/^\d+$/.test(idRaw)) {
      toast.error('Student ID must be a number.')
      return
    }
    try {
      setEditSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setEditSaving(false)
        return
      }
      const response = await fetch('/api/students', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: student.id,
          studentIdentifier: idRaw,
          fullName: name,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to update student.')
        setEditSaving(false)
        return
      }
      setStudent({
        ...student,
        full_name: name,
        student_identifier: Number(idRaw),
      })
      setEditOpen(false)
      toast.success(data.success || 'Student updated.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleAddStudent = async () => {
    if (!newStudentGrade) {
      toast.error('Please select an HSCP grade.')
      return
    }
    if (!newStudentId.trim()) {
      toast.error('Please enter a Student ID.')
      return
    }
    if (!newStudentName.trim()) {
      toast.error('Please enter the student name.')
      return
    }

    const studentIdNum = Number(newStudentId.trim())
    if (!Number.isInteger(studentIdNum) || studentIdNum <= 0) {
      toast.error('Student ID must be a positive number.')
      return
    }

    setAddingStudent(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setAddingStudent(false)
        return
      }

      const response = await fetch('/api/hscp-students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grade: newStudentGrade,
          schoolYear: currentSchoolYear,
          studentIdentifier: newStudentId.trim(),
          fullName: newStudentName.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to add student.')
      } else {
        toast.success(data.success || 'Student added successfully.')
        // Reset form
        setNewStudentGrade('')
        setNewStudentId('')
        setNewStudentName('')
        // PREVIOUS: also closed the Add Student dialog
        // setAddDialogOpen(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setAddingStudent(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ========== PREVIOUS HEADER UI (kept for easy revert) ==========
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-1">
              HSCP Student Attendance Lookup
            </h2>
            <p className="text-base text-muted-foreground">
              Search for student attendance records in HSCP sections (read-only).
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <HSCPBulkStudentUpload schoolYear={currentSchoolYear} />
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </Button>
          </div>
        </div>
      </div>
      ========== END PREVIOUS HEADER UI ========== */}

      {/* Page header */}
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-1">
          HSCP Student Management
        </h2>
        <p className="text-base text-muted-foreground">
          Add HSCP students (one at a time or in bulk), then search attendance records.
          School year: <span className="font-medium text-[#0f172a]">{currentSchoolYear}</span>
        </p>
      </div>

      {/* Section 2: Add single student */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="w-5 h-5 text-[#6366f1]" />
            Add a Single Student
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Enter one student&apos;s details to add them to an HSCP grade.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hscp-grade-inline">HSCP Grade *</Label>
              <select
                id="hscp-grade-inline"
                value={newStudentGrade}
                onChange={(e) => setNewStudentGrade(e.target.value)}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2"
              >
                <option value="">Select a grade</option>
                {availableHscpGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-id-inline">Student ID *</Label>
              <Input
                id="student-id-inline"
                type="number"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="e.g., 3434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-name-inline">Student Name *</Label>
              <Input
                id="student-name-inline"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="e.g., John Doe"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The student will be added for the selected HSCP grade (Reading, Writing, Conversation).
            School year: {currentSchoolYear}
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleAddStudent}
              disabled={addingStudent}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {addingStudent ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Bulk upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-[#6366f1]" />
            Upload Students in Bulk
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Upload a CSV file to add many HSCP students at once.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 sm:p-5">
            <HSCPBulkStudentUpload schoolYear={currentSchoolYear} />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-[#334155]">CSV format</p>
            <p>Columns (in order): <span className="font-mono text-xs">Student ID, Student Name, Grade</span></p>
            <p>Grade values: <span className="font-mono text-xs">HSCP1</span>, <span className="font-mono text-xs">HSCP2</span>, or <span className="font-mono text-xs">HSCP3</span></p>
            <p className="font-mono text-xs bg-white border rounded px-2 py-1.5 inline-block mt-1">
              9001,Arun Kumar,HSCP1
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Lookup / search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Search Student Attendance</CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Look up an HSCP student by Student ID and school year (read-only).
          </p>
        </CardHeader>
        <CardContent>
          <StudentAttendanceSearch
            initialStudentId={studentIdInput}
            initialYear={yearInput}
            availableYears={availableYears}
            basePath="/hscp-officer/student-attendance"
          />
        </CardContent>
      </Card>

      {errorMessage && (
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {!loading && student && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle>Student Information</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={openEditStudent}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Student
                  </Button>
                  {student.is_active !== false && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={statusPending}
                      onClick={() => handleSetActiveStatus(false)}
                    >
                      <UserX className="w-4 h-4" />
                      {statusPending ? 'Updating...' : 'Mark Discontinued'}
                    </Button>
                  )}
                  {student.is_active === false && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={statusPending}
                      onClick={() => handleSetActiveStatus(true)}
                    >
                      <UserCheck className="w-4 h-4" />
                      {statusPending ? 'Updating...' : 'Reactivate'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Name:</strong> {student.full_name}
                {student.is_active === false && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-medium">
                    Discontinued
                  </span>
                )}
              </p>
              <p><strong>Student ID:</strong> {student.student_identifier}</p>
              {sectionInfo && (
                <p><strong>Grade:</strong> {sectionInfo.grade}</p>
              )}
              <p><strong>School Year:</strong> {yearInput}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {hscpSections.length > 0 ? (
                <div className="space-y-4">
                  {/* Tab buttons */}
                  <div className="flex gap-2 border-b border-gray-200">
                    {hscpSections.map((hscpSection) => (
                      <button
                        key={hscpSection.id}
                        onClick={() => setSelectedHscpTab(hscpSection.section)}
                        className={`px-4 py-2 font-medium text-sm transition-colors ${
                          selectedHscpTab === hscpSection.section
                            ? 'border-b-2 border-[#6366f1] text-[#6366f1]'
                            : 'text-[#64748b] hover:text-[#0f172a]'
                        }`}
                      >
                        {hscpSection.section}
                      </button>
                    ))}
                  </div>
                  
                  {/* Filtered attendance for selected tab */}
                  {(() => {
                    const selectedSection = hscpSections.find(s => s.section === selectedHscpTab)
                    const filteredAttendance = selectedSection
                      ? attendance.filter(a => a.section_id === selectedSection.id)
                      : []
                    
                    return filteredAttendance.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Date</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Comments</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAttendance.map((record, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2">
                                  {new Date(record.attendance_date).toLocaleDateString()}
                                </td>
                                <td className="p-2 capitalize">{record.status}</td>
                                <td className="p-2">{record.comments || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No attendance records found for {selectedHscpTab} section.
                      </p>
                    )
                  })()}
                </div>
              ) : attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">
                            {new Date(record.attendance_date).toLocaleDateString()}
                          </td>
                          <td className="p-2 capitalize">{record.status}</td>
                          <td className="p-2">{record.comments || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No attendance records found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== PREVIOUS ADD-STUDENT DIALOG (kept for easy revert) ==========
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add HSCP Student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hscp-grade">HSCP Grade *</Label>
              <select
                id="hscp-grade"
                value={newStudentGrade}
                onChange={(e) => setNewStudentGrade(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a grade</option>
                {availableHscpGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-id">Student ID *</Label>
              <Input
                id="student-id"
                type="number"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="e.g., 3434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-name">Student Name *</Label>
              <Input
                id="student-name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="e.g., John Doe"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The student will be added to all sections (Reading, Writing, Conversation) of the selected HSCP grade.
              School Year: {currentSchoolYear}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false)
                setNewStudentGrade('')
                setNewStudentId('')
                setNewStudentName('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddStudent}
              disabled={addingStudent}
            >
              {addingStudent ? 'Adding...' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ========== END PREVIOUS ADD-STUDENT DIALOG ========== */}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update name or Student ID. Grade/section are not changed for HSCP students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="hscp-edit-student-name">Full Name *</Label>
              <Input
                id="hscp-edit-student-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Student full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hscp-edit-student-id">Student ID *</Label>
              <Input
                id="hscp-edit-student-id"
                value={editStudentId}
                onChange={(e) => setEditStudentId(e.target.value)}
                placeholder="Numeric student ID"
              />
            </div>
            {sectionInfo && (
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input value={sectionInfo.grade} disabled />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveStudentEdit()} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
