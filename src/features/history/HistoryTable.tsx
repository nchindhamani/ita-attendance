"use client";

import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type HistoryRow = {
  student_name: string;
  status: string;
  comments: string | null;
};

export function HistoryTable({
  rows,
  filename,
}: {
  rows: HistoryRow[];
  filename: string;
}) {
  const handleDownload = () => {
    if (!rows.length) {
      toast.error("No attendance data to download.");
      return;
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleDownload}>
          Download CSV
        </Button>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.student_name}-${index}`}>
                <TableCell className="font-medium">
                  {row.student_name}
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>{row.comments ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No attendance recorded for this date.
        </div>
      )}
    </div>
  );
}

