"use client";

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

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="role" value={role} />
      <div className="space-y-2">
        <label className="text-sm font-medium">Full name</label>
        <Input name="full_name" placeholder="Vedha S." required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Mobile</label>
        <Input name="mobile" placeholder="(555) 123-4567" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input
          name="email"
          type="email"
          placeholder="teacher@ita.org"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Grade</label>
          <Input
            name="grade"
            placeholder="5"
            required={requireTeacherFields}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Section</label>
          <Input
            name="section"
            placeholder="A"
            required={requireTeacherFields}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Room number</label>
        <Input
          name="room_number"
          placeholder="Room 12"
          required={requireTeacherFields}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input name="password" type="password" required />
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

