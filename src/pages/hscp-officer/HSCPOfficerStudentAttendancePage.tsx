import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StudentAttendanceSearch } from '@/features/admin/StudentAttendanceSearch'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

const supabase = createSupabaseBrowserClient()

interface Student {
  id: string
  full_name: string
  student_identifier: number | null
  section_id: string | null
  school_year: string
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
  const navigate = useNavigate()
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

  // Add Student Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [availableHscpGrades, setAvailableHscpGrades] = useState<string[]>([])
  const [newStudentGrade, setNewStudentGrade] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [currentSchoolYear, setCurrentSchoolYear] = useState('2025-2026')

  // Fetch current school year and available HSCP grades on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Get current school year
        const { data: settings } = await supabase
          .from('system_settings')
          .select('current_school_year')
          .eq('id', 1)
          .maybeSingle()

        const sy = settings?.current_school_year || '2025-2026'
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
        // Reset form and close dialog
        setNewStudentGrade('')
        setNewStudentId('')
        setNewStudentName('')
        setAddDialogOpen(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setAddingStudent(false)
    }
  }

  return (
    <div className="space-y-6">
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
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </Button>
        </div>
      </div>

      <StudentAttendanceSearch 
        initialStudentId={studentIdInput}
        initialYear={yearInput}
        availableYears={availableYears}
        basePath="/hscp-officer/student-attendance"
      />

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
              <CardTitle>Student Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Name:</strong> {student.full_name}</p>
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

      {/* Add HSCP Student Dialog */}
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
    </div>
  )
}
