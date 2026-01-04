"use server";


import supabaseAdmin from "@/lib/supabase/server";
import { cookies } from "next/headers"; // <--- Import cookies


const COOKIE_NAME = "vatic_beta_access";

// 1. Verify Code & Set Cookie
export async function validateInviteCode(code: string) {
  const cleanCode = code.trim().toUpperCase();

  // Check DB
  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("*")
    .eq("code", cleanCode)
    .single();

  if (error || !data) {
    return { success: false, message: "Invalid access code." };
  }

  if (data.is_used) {
    return { success: false, message: "Code already claimed." };
  }

  // Mark used (Burn it)
  const { error: updateError } = await supabaseAdmin
    .from("invite_codes")
    .update({ 
      // is_used: true, 
      used_at: new Date().toISOString() 
    })
    .eq("code", cleanCode);

  if (updateError) {
    return { success: false, message: "System error." };
  }

  // SET COOKIE (HttpOnly, Secure)
  // Valid for 30 days
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, 
    path: "/",
  });

  return { success: true };
}

// 2. Check if Cookie Exists (For Layout to check on load)
export async function checkAccessCookie() {
  const cookieStore = await cookies();
  return cookieStore.has(COOKIE_NAME);
}

// 3. Waitlist (Unchanged)
export async function joinWaitlist(email: string, twitter?: string) {
  if (!email || !email.includes("@")) return { success: false, message: "Invalid email." };
  const { error } = await supabaseAdmin.from("waitlist").insert([{ email, twitter_handle: twitter }]);
  if (error && error.code === '23505') return { success: true, message: "Already on the list!" };
  if (error) return { success: false, message: "Error joining waitlist." };
  return { success: true, message: "Added to waitlist." };
}