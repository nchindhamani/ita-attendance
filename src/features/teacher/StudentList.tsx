import { useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  onStudentUpdated?: () => void | Promise<void>;
}

const supabase = createSupabaseBrowserClient();

const updateStudent = async (params: {
  studentId: string;
  studentIdentifier: string;
  fullName: string;
  sectionId: string;
}): Promise<{ success?: string; error?: string }> => {
  try {
    // Get JWT token from Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { error: "Not authenticated. Please sign in again." };
    }

    // Call Python API
    const response = await fetch("/api/students", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: params.studentId,
        studentIdentifier: params.studentIdentifier,
        fullName: params.fullName,
        sectionId: params.sectionId,
      }),
    });

    // Check if response has content before parsing
    const contentType = response.headers.get("content-type");
    const responseText = await response.text();

    // Handle empty responses
    if (!responseText || responseText.trim() === "") {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. Empty response from server.` 
      };
    }

    // Check if response is JSON
    if (!contentType || !contentType.includes("application/json")) {
      return { 
        error: `Server error: ${response.status} ${response.statusText}. ${responseText.substring(0, 200)}` 
      };
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return { 
        error: `Failed to parse server response: ${responseText.substring(0, 200)}` 
      };
    }

    if (!response.ok) {
      return { error: data.detail || data.error || "Failed to update student." };
    }

    return { success: data.success || "Student updated." };
  } catch (e: any) {
    return { error: e.message || "An unexpected error occurred." };
  }
};

export function StudentList({ students, sectionId, onStudentUpdated }: StudentListProps) {
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
      }).then(async (result) => {
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(result?.success ?? "Student updated successfully!");
          setEditStudentId(null);
          // Refresh student list
          if (onStudentUpdated) {
            await onStudentUpdated();
          }
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

