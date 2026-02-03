"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileForm } from "./ProfileForm";

interface ProfileViewProps {
  profileData: {
    id: string;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
    role: "admin" | "teacher";
    grade: string | null;
    section: string | null;
    room_number: string | null;
    created_at: string;
  };
}

function getInitials(name: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function ProfileView({ profileData }: ProfileViewProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const initials = getInitials(profileData.full_name);
  const isTeacher = profileData.role === "teacher";

  return (
    <div className="space-y-8">
      {/* Header with Title and Edit Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          My Profile
        </h2>
        <Button
          variant="outline"
          onClick={() => setIsEditOpen(true)}
          className="bg-white border-[#e2e8f0] hover:bg-[#f8fafc]"
        >
          Edit Profile
        </Button>
      </div>

      {/* Profile Card */}
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-12">
            {/* Avatar */}
            <div className="flex justify-center mb-8">
              <div
                className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-2xl font-semibold shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #8b5cf6 0%, #10b981 100%)",
                }}
              >
                {initials}
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-6">
              <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Full Name
                </span>
                <span className="text-base font-medium text-[#1e293b]">
                  {profileData.full_name || "-"}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Email
                </span>
                <span className="text-base font-medium text-[#1e293b]">
                  {profileData.email || "-"}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Mobile
                </span>
                <span className="text-base font-medium text-[#1e293b]">
                  {profileData.mobile || "-"}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Role
                </span>
                <span className="text-base font-medium text-[#1e293b] capitalize">
                  {profileData.role}
                </span>
              </div>

              {isTeacher && (
                <>
                  {profileData.grade && (
                    <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                        Grade
                      </span>
                      <span className="text-base font-medium text-[#1e293b]">
                        {profileData.grade}
                      </span>
                    </div>
                  )}

                  {profileData.section && (
                    <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                        Section
                      </span>
                      <span className="text-base font-medium text-[#1e293b]">
                        {profileData.section}
                      </span>
                    </div>
                  )}

                  {profileData.room_number && (
                    <div className="flex justify-between items-center py-3 border-b border-[#e2e8f0]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                        Room Number
                      </span>
                      <span className="text-base font-medium text-[#1e293b]">
                        {profileData.room_number}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                  Member Since
                </span>
                <span className="text-base font-medium text-[#1e293b]">
                  {profileData.created_at
                    ? new Date(profileData.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )
                    : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <ProfileForm
            initialData={profileData}
            onSuccess={() => {
              setIsEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

