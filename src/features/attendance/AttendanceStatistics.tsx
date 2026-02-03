"use client";

type AttendanceStatus = "present" | "absent" | "late" | "left_early";

interface AttendanceStatisticsProps {
  counts: {
    present: number;
    absent: number;
    late: number;
    left_early: number;
  };
}

export function AttendanceStatistics({ counts }: AttendanceStatisticsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-[2.5rem] font-bold text-[#10b981] mb-2">
          {counts.present}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Present
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-[2.5rem] font-bold text-[#ef4444] mb-2">
          {counts.absent}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Absent
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-[2.5rem] font-bold text-[#f97316] mb-2">
          {counts.late}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Late
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-[2.5rem] font-bold text-[#8b5cf6] mb-2">
          {counts.left_early}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Left Early
        </div>
      </div>
    </div>
  );
}

