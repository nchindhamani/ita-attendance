// AttendanceStatus type is imported from @/lib/types

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
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#e5e7eb] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]">
        <div className="text-[2.5rem] font-bold mb-2 text-[#10b981]">
          {counts.present}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Present
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#e5e7eb] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]">
        <div className="text-[2.5rem] font-bold mb-2 text-[#ef4444]">
          {counts.absent}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Absent
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#e5e7eb] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]">
        <div className="text-[2.5rem] font-bold mb-2 text-[#f97316]">
          {counts.late}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Late
        </div>
      </div>
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#e5e7eb] transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:border-[#6366f1]">
        <div className="text-[2.5rem] font-bold mb-2 text-[#8b5cf6]">
          {counts.left_early}
        </div>
        <div className="text-sm font-medium text-[#64748b] uppercase tracking-wide">
          Left Early
        </div>
      </div>
    </div>
  );
}

