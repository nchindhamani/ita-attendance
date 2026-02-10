"use client";

import { useFormState } from "@/lib/react-dom-polyfill";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// TODO: Convert to API call to /api/auth/update-password
// import { updatePassword } from "@/app/(auth)/auth/actions";
const updatePassword = async (prevState: any, formData: FormData): Promise<{ error?: string }> => {
  return { error: "Not implemented - convert to API call" };
};

const initialState: { error?: string } = {};

export function UpdatePasswordForm() {
  const [state, formAction] = useFormState(updatePassword, initialState);

  return (
    <form className="space-y-4" action={formAction}>
      <div className="space-y-2">
        <label className="text-sm font-medium">New password</label>
        <Input name="password" type="password" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="w-full" type="submit">
        Update password
      </Button>
    </form>
  );
}

