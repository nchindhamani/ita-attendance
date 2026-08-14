import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRequireRole } from '@/lib/auth-client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getCurrentSchoolYear } from '@/lib/school-year'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StudentAttendanceSearch } from '@/features/admin/StudentAttendanceSearch'
import { HSCPBulkStudentUpload } from '@/features/hscp/HSCPBulkStudentUpload'
import { toast } from 'sonner'
import { Trash2, Upload, UserPlus, UserX, UserCheck, Pencil } from 'lucide-react'
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

const statusColors = {
  present: 'bg-[#d1fae5] text-[#065f46]',
  absent: 'bg-[#fee2e2] text-[#991b1b]',
  late: 'bg-[#fed7aa] text-[#9a3412]',
  left_early: 'bg-[#e9d5ff] text-[#6b21a8]',
}

export default function AdminStudentAttendancePage() {
  useRequireRole('admin')
  const [searchParams] = useSearchParams()

  const studentIdInput = searchParams.get('studentId')?.trim() || ''
  const yearInput = searchParams.get('year')?.trim() || ''

  const [loading, setLoading] = useState(false)
  const [availableYears, setAvailableYears] = useState<string[]>([])
  const [student, setStudent] = useState<Student | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [sectionInfo, setSectionInfo] = useState<{ grade: string; section: string } | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hscpSections, setHscpSections] = useState<HSCPSection[]>([])
  const [selectedHscpTab, setSelectedHscpTab] = useState<string>('Reading')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusPending, setStatusPending] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStudentId, setEditStudentId] = useState('')
  const [editSectionId, setEditSectionId] = useState('')
  const [editSectionOptions, setEditSectionOptions] = useState<{ id: string; section: string }[]>([])

  const [availableGrades, setAvailableGrades] = useState<string[]>([])
  const [availableSectionsForGrade, setAvailableSectionsForGrade] = useState<string[]>([])
  const [newStudentGrade, setNewStudentGrade] = useState('')
  const [newStudentSection, setNewStudentSection] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [currentSchoolYear, setCurrentSchoolYear] = useState(getCurrentSchoolYear())

  const isHscpGrade = (grade: string) => grade.trim().toUpperCase().startsWith('HSCP')

  useEffect(() => {
    const sy = getCurrentSchoolYear()
    setCurrentSchoolYear(sy)

    const fetchGrades = async () => {
      const { data: sectionsData } = await supabase
        .from('sections')
        .select('grade')
        .eq('school_year', sy)
        .order('grade', { ascending: true })

      if (sectionsData) {
        const gradeSet = new Set<string>()
        sectionsData.forEach((s) => {
          if (s.grade) gradeSet.add(s.grade)
        })
        setAvailableGrades(Array.from(gradeSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
      }
    }

    fetchGrades()
  }, [])

  useEffect(() => {
    const fetchSectionsForGrade = async () => {
      setNewStudentSection('')
      setAvailableSectionsForGrade([])
      if (!newStudentGrade) return

      const { data: sectionsData } = await supabase
        .from('sections')
        .select('section')
        .eq('grade', newStudentGrade)
        .eq('school_year', currentSchoolYear)
        .order('section', { ascending: true })

      if (sectionsData) {
        setAvailableSectionsForGrade(
          sectionsData.map((s) => s.section).filter((s): s is string => Boolean(s))
        )
      }
    }

    fetchSectionsForGrade()
  }, [newStudentGrade, currentSchoolYear])

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
        const yearSet = new Set<string>()

        const { data: attendanceYearRows } = await supabase
          .from('student_attendance')
          .select('school_year')
          .eq('student_identifier', studentIdNum)
          .order('school_year', { ascending: false })

        ;(attendanceYearRows ?? []).forEach((row) => {
          if (row.school_year) yearSet.add(row.school_year)
        })

        const { data: studentYearRows } = await supabase
          .from('students')
          .select('school_year')
          .eq('student_identifier', studentIdNum)
          .order('school_year', { ascending: false })

        ;(studentYearRows ?? []).forEach((row) => {
          if (row.school_year) yearSet.add(row.school_year)
        })

        setAvailableYears(Array.from(yearSet).sort().reverse())
        setErrorMessage(null)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
        setAvailableYears([])
      }
    }

    fetchYears()
  }, [studentIdInput])

  useEffect(() => {
    if (!studentIdInput || !yearInput) {
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      setTeacherName(null)
      setHscpSections([])
      setSelectedHscpTab('Reading')
      return
    }

    const fetchStudentData = async () => {
      setLoading(true)
      setErrorMessage(null)
      setHscpSections([])
      setSelectedHscpTab('Reading')
      setTeacherName(null)

      try {
        const studentIdNum = Number(studentIdInput)
        if (!Number.isInteger(studentIdNum)) {
          setErrorMessage('Student ID must be a valid number.')
          setLoading(false)
          return
        }

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select(`
            id,
            full_name,
            student_identifier,
            section_id,
            school_year,
            is_active,
            discontinued_at,
            sections(grade, section)
          `)
          .eq('student_identifier', studentIdNum)
          .eq('school_year', yearInput)
          .maybeSingle()

        if (studentError) {
          setErrorMessage(`Error fetching student: ${studentError.message}`)
          setLoading(false)
          return
        }

        if (!studentData) {
          setErrorMessage('Student not found for this school year.')
          setLoading(false)
          return
        }

        const section = Array.isArray(studentData.sections)
          ? studentData.sections[0]
          : studentData.sections

        setStudent({
          id: studentData.id,
          full_name: studentData.full_name,
          student_identifier: studentData.student_identifier,
          section_id: studentData.section_id,
          school_year: studentData.school_year,
          is_active: (studentData as { is_active?: boolean | null }).is_active ?? true,
          discontinued_at: (studentData as { discontinued_at?: string | null }).discontinued_at ?? null,
        })

        if (section) {
          setSectionInfo({ grade: section.grade, section: section.section })

          if (String(section.grade).toUpperCase().startsWith('HSCP')) {
            const { data: allSections } = await supabase
              .from('sections')
              .select('id,section')
              .eq('grade', section.grade)
              .eq('school_year', yearInput)
              .in('section', ['Reading', 'Writing', 'Conversation'])
              .order('section', { ascending: true })

            if (allSections) {
              setHscpSections(allSections as HSCPSection[])
              if (allSections.length > 0) {
                setSelectedHscpTab(allSections[0].section)
              }
            }
          } else if (studentData.section_id) {
            const { data: teacherRows } = await supabase
              .from('teacher_sections')
              .select('teacher_id, profiles(full_name)')
              .eq('section_id', studentData.section_id)
              .limit(1)

            const row = teacherRows?.[0] as { profiles?: { full_name?: string } | { full_name?: string }[] } | undefined
            const profile = Array.isArray(row?.profiles) ? row?.profiles[0] : row?.profiles
            if (profile?.full_name) {
              setTeacherName(profile.full_name)
            }
          }
        }

        const { data: attendanceData, error: attendanceError } = await supabase
          .from('student_attendance')
          .select('attendance_date,status,comments,section_id')
          .eq('student_id', studentData.id)
          .eq('school_year', yearInput)
          .order('attendance_date', { ascending: false })

        if (attendanceError) {
          console.error('Error fetching attendance:', attendanceError)
        } else {
          setAttendance(attendanceData ?? [])
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [studentIdInput, yearInput])

  const handleAddStudent = async () => {
    if (!newStudentGrade) {
      toast.error('Please select a grade.')
      return
    }
    if (!isHscpGrade(newStudentGrade) && !newStudentSection.trim()) {
      toast.error('Section is required for non-HSCP grades.')
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

      const response = await fetch('/api/students/by-grade', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grade: newStudentGrade,
          section: isHscpGrade(newStudentGrade) ? undefined : newStudentSection.trim() || undefined,
          studentIdentifier: newStudentId.trim(),
          fullName: newStudentName.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to add student.')
      } else {
        toast.success(data.success || 'Student added successfully.')
        setNewStudentGrade('')
        setNewStudentSection('')
        setNewStudentId('')
        setNewStudentName('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred.')
    } finally {
      setAddingStudent(false)
    }
  }

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

  const openEditStudent = async () => {
    if (!student || !sectionInfo) return
    setEditName(student.full_name || '')
    setEditStudentId(String(student.student_identifier ?? ''))
    setEditSectionId(student.section_id || '')
    setEditSectionOptions([])

    if (!isHscpGrade(sectionInfo.grade)) {
      const { data: sectionsData } = await supabase
        .from('sections')
        .select('id,section')
        .eq('grade', sectionInfo.grade)
        .eq('school_year', student.school_year)
        .order('section', { ascending: true })
      setEditSectionOptions(
        (sectionsData || [])
          .filter((s) => s.id && s.section)
          .map((s) => ({ id: s.id as string, section: s.section as string }))
      )
    }
    setEditOpen(true)
  }

  const handleSaveStudentEdit = async () => {
    if (!student || !sectionInfo || editSaving) return
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
    const isHscp = isHscpGrade(sectionInfo.grade)
    if (!isHscp && !editSectionId) {
      toast.error('Section is required for regular-grade students.')
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
      const body: Record<string, string> = {
        studentId: student.id,
        studentIdentifier: idRaw,
        fullName: name,
      }
      if (!isHscp) {
        body.sectionId = editSectionId
      }
      const response = await fetch('/api/students', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to update student.')
        setEditSaving(false)
        return
      }

      const selectedSection = editSectionOptions.find((s) => s.id === editSectionId)
      setStudent({
        ...student,
        full_name: name,
        student_identifier: Number(idRaw),
        section_id: isHscp ? student.section_id : editSectionId,
      })
      if (!isHscp && selectedSection) {
        setSectionInfo({ grade: sectionInfo.grade, section: selectedSection.section })
      }
      setEditOpen(false)
      toast.success(data.success || 'Student updated.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteStudent = async () => {
    if (!student || deleting) return
    try {
      setDeleting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated. Please sign in again.')
        setDeleting(false)
        return
      }
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(data.error || data.detail || 'Failed to delete student.')
        setDeleting(false)
        return
      }
      setDeleteConfirmOpen(false)
      setStudent(null)
      setAttendance([])
      setSectionInfo(null)
      setTeacherName(null)
      setHscpSections([])
      setAvailableYears((prev) => prev.filter((y) => y !== yearInput))
      toast.success(data.message || 'Student deleted.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-1">
          Student Management
        </h2>
        <p className="text-base text-muted-foreground">
          Add students (one at a time or in bulk) for any grade, then search attendance records.
          School year: <span className="font-medium text-[#0f172a]">{currentSchoolYear}</span>
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="w-5 h-5 text-[#6366f1]" />
            Add a Single Student
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Enter one student&apos;s details. Section is required for regular grades.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="admin-grade">Grade *</Label>
              <select
                id="admin-grade"
                value={newStudentGrade}
                onChange={(e) => setNewStudentGrade(e.target.value)}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2"
              >
                <option value="">Select a grade</option>
                {availableGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-section">
                Section {newStudentGrade && !isHscpGrade(newStudentGrade) ? '*' : ''}
              </Label>
              <select
                id="admin-section"
                value={newStudentSection}
                onChange={(e) => setNewStudentSection(e.target.value)}
                disabled={!newStudentGrade || isHscpGrade(newStudentGrade)}
                className="flex h-12 w-full rounded-[10px] border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {!newStudentGrade
                    ? 'Select a grade first'
                    : isHscpGrade(newStudentGrade)
                      ? 'Not required for HSCP'
                      : 'Select a section'}
                </option>
                {newStudentGrade &&
                  !isHscpGrade(newStudentGrade) &&
                  availableSectionsForGrade.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-student-id">Student ID *</Label>
              <Input
                id="admin-student-id"
                type="number"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="e.g., 3434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-student-name">Student Name *</Label>
              <Input
                id="admin-student-name"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="e.g., John Doe"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            HSCP students are added to all HSCP sections for that grade. Regular students are added only to the selected section. School year: {currentSchoolYear}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5 text-[#6366f1]" />
            Upload Students in Bulk
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Upload a CSV file to add many students at once (any grade with sections for this school year).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 sm:p-5">
            <HSCPBulkStudentUpload
              schoolYear={currentSchoolYear}
              endpoint="/api/students/bulk-by-grade"
              includeSectionColumn
            />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-[#334155]">CSV format</p>
            <p>
              Columns (in order):{' '}
              <span className="font-mono text-xs">Student ID, Student Name, Grade, Section</span>
            </p>
            <p>
              For <span className="font-medium">non-HSCP</span> grades, Section is <span className="font-medium">required</span> (e.g. A, B).
            </p>
            <p>
              For <span className="font-medium">HSCP</span> grades, Section is ignored (leave empty). The student
              is added for Reading, Writing, and Conversation.
            </p>
            <p className="font-mono text-xs bg-white border rounded px-2 py-1.5 inline-block mt-1">
              9001,Arun Kumar,3,A
            </p>
            <p className="font-mono text-xs bg-white border rounded px-2 py-1.5 inline-block mt-1 ml-0 sm:ml-2">
              9002,Priya Raj,HSCP1,
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Search Student Attendance</CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Look up a student by Student ID and school year.
          </p>
        </CardHeader>
        <CardContent>
          <StudentAttendanceSearch
            initialStudentId={studentIdInput}
            initialYear={yearInput}
            availableYears={availableYears}
            hasError={!!errorMessage}
            basePath="/admin/student-attendance"
          />
          {errorMessage ? (
            <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {studentIdInput && availableYears.length === 0 && !errorMessage ? (
            <p className="mt-3 text-sm text-destructive">
              No student found for this ID. Please verify the student ID.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {!loading && student && (
        <div className="space-y-6">
          <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <h3 className="text-[1.75rem] font-heading font-bold text-[#0f172a] leading-tight">
                    {student.full_name}
                  </h3>
                  {student.is_active === false && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-medium">
                      Discontinued
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-[#64748b]">ID: {student.student_identifier ?? '-'}</p>
                  {sectionInfo && (
                    <p className="text-sm text-[#64748b]">
                      {sectionInfo.grade.toUpperCase().startsWith('HSCP')
                        ? `Grade: ${sectionInfo.grade}`
                        : `Class: Grade ${sectionInfo.grade} - ${sectionInfo.section}`}
                    </p>
                  )}
                  {teacherName && (
                    <p className="text-sm text-[#64748b]">Teacher: {teacherName}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void openEditStudent()}
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
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Student
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xl font-heading font-semibold text-[#0f172a]">
              Attendance History
            </h4>

            {hscpSections.length > 0 ? (
              <div className="space-y-4">
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
                {(() => {
                  const selectedSection = hscpSections.find((s) => s.section === selectedHscpTab)
                  const filteredAttendance = selectedSection
                    ? attendance.filter((a) => a.section_id === selectedSection.id)
                    : []
                  return filteredAttendance.length > 0 ? (
                    <div className="space-y-3">
                      {filteredAttendance.map((row) => {
                        const statusColor =
                          statusColors[row.status as keyof typeof statusColors] ||
                          'bg-gray-100 text-gray-700'
                        return (
                          <div
                            key={`${row.attendance_date}-${row.section_id}`}
                            className="bg-[#f8f9fa] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base font-medium text-[#0f172a] w-32 flex-shrink-0">
                                {row.attendance_date}
                              </span>
                              <span
                                className={`px-3 py-1 rounded-[8px] text-sm font-medium capitalize whitespace-nowrap ${statusColor}`}
                              >
                                {row.status}
                              </span>
                              {row.comments && (
                                <span className="text-sm text-[#64748b]">{row.comments}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No attendance recorded for {selectedHscpTab} section yet.
                    </p>
                  )
                })()}
              </div>
            ) : attendance.length > 0 ? (
              <div className="space-y-3">
                {attendance.map((row) => {
                  const statusColor =
                    statusColors[row.status as keyof typeof statusColors] ||
                    'bg-gray-100 text-gray-700'
                  return (
                    <div
                      key={row.attendance_date}
                      className="bg-[#f8f9fa] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-medium text-[#0f172a] w-32 flex-shrink-0">
                          {row.attendance_date}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-[8px] text-sm font-medium capitalize whitespace-nowrap ${statusColor}`}
                        >
                          {row.status}
                        </span>
                        {row.comments && (
                          <span className="text-sm text-[#64748b]">{row.comments}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No attendance recorded for this student yet.
              </p>
            )}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update name or Student ID
              {sectionInfo && !isHscpGrade(sectionInfo.grade)
                ? '. Section can be changed within the same grade; past attendance stays with the previous section.'
                : '. Grade and section are not changed for HSCP students.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-student-name">Full Name *</Label>
              <Input
                id="edit-student-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Student full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-id">Student ID *</Label>
              <Input
                id="edit-student-id"
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
            {sectionInfo && !isHscpGrade(sectionInfo.grade) && (
              <div className="space-y-2">
                <Label htmlFor="edit-student-section">Section *</Label>
                <select
                  id="edit-student-section"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editSectionId}
                  onChange={(e) => setEditSectionId(e.target.value)}
                >
                  <option value="">Select a section</option>
                  {editSectionOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.section}
                    </option>
                  ))}
                </select>
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              This will permanently remove this student and all their attendance data. This action cannot be undone. Do you still wish to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              No
            </Button>
            <Button variant="destructive" onClick={handleDeleteStudent} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
