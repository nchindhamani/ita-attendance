import { useState, useTransition } from "react";
import { updateStudent } from "@/app/(dashboard)/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Student {
  id: string;
  student_identifier: number | null;
  full_name: string;
}

interface StudentListProps {
  students: Student[];
  sectionId: string;
}

export function StudentList({ students, sectionId }: StudentListProps) {
  const [isPending, startTransition] = useTransition();
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [editStudentIdentifier, setEditStudentIdentifier] = useState("");
  const [editStudentName, setEditStudentName] = useState("");

  const openEditDialog = (student: Student) => {
    setEditStudentId(student.id);
    setEditStudentIdentifier(
      student.student_identifier ? String(student.student_identifier) : ""
    );
    setEditStudentName(student.full_name);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editStudentId) return;
    if (!editStudentIdentifier.trim() || !editStudentName.trim()) {
      toast.error("Student ID and name are required.");
      return;
    }

    startTransition(() => {
      updateStudent({
        studentId: editStudentId,
        studentIdentifier: editStudentIdentifier.trim(),
        fullName: editStudentName.trim(),
        sectionId,
      }).then((result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Student updated successfully!");
          setEditStudentId(null);
        }
      });
    });
  };

  return (
    <>
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students in this class yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-mono">
                    {student.student_identifier ?? "-"}
                  </TableCell>
                  <TableCell>{student.full_name}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(student)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editStudentId !== null} onOpenChange={(open) => !open && setEditStudentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Student ID <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                value={editStudentIdentifier}
                onChange={(event) => setEditStudentIdentifier(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Student Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={editStudentName}
                onChange={(event) => setEditStudentName(event.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditStudentId(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

