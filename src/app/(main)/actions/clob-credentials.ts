"use server";

import supabaseAdmin from "@/lib/supabase/server";

export interface ClobCredentials {
  address: string;
  apiKey: string;
  secret: string;
  passphrase: string;
}

/**
 * Fetch CLOB API credentials for a user
 * Returns null if no credentials found
 */
export async function fetchClobCredentials(
  userId: string
): Promise<ClobCredentials | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("polymarket_api_keys")
      .select("address, key, secret, passphrase")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching CLOB credentials:", error);
      return null;
    }

    if (!data) {
      console.log(`No CLOB credentials found for user ${userId}`);
      return null;
    }

    return {
      address: data.address,
      apiKey: data.key,
      secret: data.secret,
      passphrase: data.passphrase,
    };
  } catch (error) {
    console.error("Unexpected error fetching CLOB credentials:", error);
    return null;
  }
}
