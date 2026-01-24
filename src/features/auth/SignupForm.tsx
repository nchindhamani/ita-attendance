"use client";

import { useFormState } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithPassword } from "@/app/(auth)/auth/actions";

const initialState: { error?: string } = {};

export function SignupForm() {
  const [state, formAction] = useFormState(signUpWithPassword, initialState);

  return (
    <form className="space-y-4" action={formAction}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Full name</label>
        <Input name="full_name" placeholder="Vedha S." />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" placeholder="teacher@ita.org" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input name="password" type="password" />
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

