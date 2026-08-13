import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Student {
  id: string;
  student_identifier: number | null;
  full_name: string;
}

interface StudentListProps {
  students: Student[];
}

/** Read-only roster for teachers (add/edit is admin / HSCP officer only). */
export function StudentList({ students }: StudentListProps) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No students in this class yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Student Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id}>
              <TableCell className="font-mono">
                {student.student_identifier ?? "-"}
              </TableCell>
              <TableCell>{student.full_name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
