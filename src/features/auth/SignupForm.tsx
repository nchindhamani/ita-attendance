"use client";

import { useCallback, useState } from "react";
import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithPassword } from "@/app/(auth)/auth/actions";

const initialState: { error?: string } = {};

type SignupFormProps = {
  role: "teacher" | "admin";
  requireTeacherFields?: boolean;
};

export function SignupForm({ role, requireTeacherFields }: SignupFormProps) {
  const [state, formAction] = useFormState(signUpWithPassword, initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    (form: HTMLFormElement) => {
      const formData = new FormData(form);
      const nextErrors: Record<string, string> = {};
      const requiredFields = ["full_name", "email", "password"];

      if (requireTeacherFields) {
        requiredFields.push("grade", "section", "room_number");
      }

      requiredFields.forEach((field) => {
        const value = String(formData.get(field) ?? "").trim();
        if (!value) {
          nextErrors[field] = "This field is required.";
        }
      });

      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    },
    [requireTeacherFields]
  );

  return (
    <form
      className="space-y-4"
      action={formAction}
      onSubmit={(event) => {
        if (!validate(event.currentTarget)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="role" value={role} />
      <div className="space-y-2">
        <label className="text-[0.875rem] font-semibold text-[#1e293b] mb-2 block">
          Full name <span className="text-[#ef4444]">*</span>
        </label>
        <Input
          name="full_name"
          placeholder="Vedha S."
          required
          aria-invalid={Boolean(errors.full_name)}
        />
        {errors.full_name ? (
          <p className="text-xs text-destructive">{errors.full_name}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Mobile</label>
        <Input name="mobile" placeholder="(555) 123-4567" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Email <span className="text-destructive">*</span>
        </label>
        <Input
          name="email"
          type="email"
          placeholder="teacher@ita.org"
          required
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email}</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Grade{" "}
            {requireTeacherFields ? (
              <span className="text-destructive">*</span>
            ) : null}
          </label>
          <Input
            name="grade"
            placeholder="5"
            required={requireTeacherFields}
            aria-invalid={Boolean(errors.grade)}
          />
          {errors.grade ? (
            <p className="text-xs text-destructive">{errors.grade}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Section{" "}
            {requireTeacherFields ? (
              <span className="text-destructive">*</span>
            ) : null}
          </label>
          <Input
            name="section"
            placeholder="A"
            required={requireTeacherFields}
            aria-invalid={Boolean(errors.section)}
          />
          {errors.section ? (
            <p className="text-xs text-destructive">{errors.section}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Room number{" "}
          {requireTeacherFields ? (
            <span className="text-destructive">*</span>
          ) : null}
        </label>
        <Input
          name="room_number"
          placeholder="Room 12"
          required={requireTeacherFields}
          aria-invalid={Boolean(errors.room_number)}
        />
        {errors.room_number ? (
          <p className="text-xs text-destructive">{errors.room_number}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Password <span className="text-destructive">*</span>
        </label>
        <Input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password}</p>
        ) : null}
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="w-full" type="submit">
        Create account
      </Button>
    </form>
  );
}

