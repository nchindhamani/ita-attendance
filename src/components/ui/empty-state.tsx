// React import not needed with new JSX transform
import { CheckCircle2, Inbox, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: "check" | "inbox" | "users";
  title: string;
  description: string;
  className?: string;
}

const iconMap = {
  check: CheckCircle2,
  inbox: Inbox,
  users: Users,
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  className,
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <div className={cn("text-center py-16 px-8", className)}>
      <div className="w-[120px] h-[120px] mx-auto mb-6 bg-gradient-to-br from-[#f0f4ff] to-[#e0e7ff] rounded-full flex items-center justify-center">
        <Icon className="w-[60px] h-[60px] text-[#6366f1] opacity-60" />
      </div>
      <h3 className="text-xl font-semibold text-[#1e293b] mb-2">{title}</h3>
      <p className="text-[0.95rem] text-[#64748b]">{description}</p>
    </div>
  );
}

