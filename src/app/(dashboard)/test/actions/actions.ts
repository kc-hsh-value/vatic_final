"use server";

import supabaseAdmin from "@/lib/supabase/server";



export type FeedFilter = "global" | "following";

export async function fetchFeed(
  userId: string, 
  filter: FeedFilter, 
  page: number = 0, 
  limit: number = 20
) {
  const offset = page * limit;
  
  // Logic: If filter is 'global', we pass null for p_user_id.
  // If 'following', we pass the actual userId.
  const dbUserId = filter === "following" ? userId : null;

  try {
    const { data, error } = await supabaseAdmin.rpc("get_correlated_feed", {
      p_user_id: dbUserId,
      p_min_urgency: 0, // You can tweak this, e.g., 5.0 to hide noise
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("RPC Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Fetch Error:", err);
    return { success: false, error: "Internal Server Error" };
  }
}