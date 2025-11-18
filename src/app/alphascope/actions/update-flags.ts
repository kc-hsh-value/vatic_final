// src/app/alphascope/actions/update-flags.ts
"use server";

import supabase from "@/lib/supabase/server";

export async function markHasSessionSigner(userId: string) {
  const {data,error} = await supabase.from("profiles").update({ signers_added: true }).eq("id", userId);
  console.log("data from markHasSigner: ",data)
  console.log("error from markeHasSigner: ",error)
  return data ? data : error
}

export async function markAllowances(userId: string) {
  return supabase.from("profiles").update({ allowances: true }).eq("id", userId);
}