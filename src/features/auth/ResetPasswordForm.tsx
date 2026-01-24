"use client";

import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/app/(auth)/auth/actions";

const initialState: { error?: string; success?: string } = {};

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, initialState);

  return (
    <form className="space-y-4" action={formAction}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" placeholder="teacher@ita.org" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600">{state.success}</p>
      ) : null}
      <Button className="w-full" type="submit">
        Send reset link
      </Button>
    </form>
  );
}

