"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  error?: string;
  message?: string;
  switchToSignIn?: boolean;
  success?: boolean;
} | null;

export async function authAction(formData: FormData): Promise<AuthActionResult> {
  const mode = formData.get("mode") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();

  if (mode === "signup") {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      const msg = error.message;
      if (msg.toLowerCase().includes("user already registered")) {
        return {
          error: "An account with this email already exists. Try signing in instead.",
          switchToSignIn: true,
        };
      }
      return { error: msg };
    }

    if (signUpData.session) {
      return { success: true };
    }

    return {
      message:
        "Account created! Check your inbox for a confirmation email, then sign in.",
      switchToSignIn: true,
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message;
    if (msg.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Please confirm your email address first. Check your inbox for a confirmation link from Supabase.",
      };
    }
    if (
      msg.toLowerCase().includes("invalid login credentials") ||
      msg.toLowerCase().includes("invalid credentials")
    ) {
      return { error: "Incorrect email or password. Please try again." };
    }
    return { error: msg };
  }

  return { success: true };
}
