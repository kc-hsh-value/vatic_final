"use server";

import supabaseAdmin from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import z from 'zod';

const X_API_KEY = process.env.X_API_KEY; 
const TW_USER_URL = 'https://api.twitterapi.io/twitter/user/info?userName=';
const HandleSchema = z.string().min(1);

// --- Helpers ---

function normHandle(h: string) {
  return (h || '').trim().replace(/^@/, '').toLowerCase();
}

async function assertFollowRateLimit(userId: string) {
  // 1. Check minute limit (10/min)
  const { data: minData, error: minErr } = await supabaseAdmin.rpc('bump_follow_limit', {
    p_user_id: userId,
    p_action: 'follow_x',
    p_limit: 10,
    p_window_seconds: 60,
  });
  
  if (minErr) throw new Error(minErr.message);
  // Handle array return if RPC returns multiple rows (it shouldn't, but safe casting)
  const minRow = Array.isArray(minData) ? minData[0] : minData;
  if (!minRow?.allowed) throw new Error("Rate limit: Please wait a moment.");

  // 2. Check daily limit (100/day)
  const { data: dayData, error: dayErr } = await supabaseAdmin.rpc('bump_follow_limit', {
    p_user_id: userId,
    p_action: 'follow_x',
    p_limit: 100,
    p_window_seconds: 86400,
  });

  if (dayErr) throw new Error(dayErr.message);
  const dayRow = Array.isArray(dayData) ? dayData[0] : dayData;
  if (!dayRow?.allowed) throw new Error("Daily follow limit reached.");
}

async function fetchTwitterUserRaw(handle: string) {
  if (!X_API_KEY) throw new Error('X_API_KEY not configured');
  
  const res = await fetch(`${TW_USER_URL}${encodeURIComponent(handle)}`, {
    method: 'GET',
    headers: { 'X-API-Key': X_API_KEY },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error('Twitter API Error');
  const json = await res.json();
  
  if (!json?.data?.userName) throw new Error('User not found on X');
  
  return json.data as {
    id: string;
    name: string;
    userName: string;
    profilePicture?: string;
    followers?: number;
    following?: number;
    statusesCount?: number;
  };
}

async function ensureXAccountWithLookup(rawHandle: string) {
  const handle = normHandle(HandleSchema.parse(rawHandle));
  
  // 1. Fetch metadata
  const tw = await fetchTwitterUserRaw(handle);

  // 2. Upsert to x_accounts
  const upsertPayload = {
    handle,
    is_active: true,
    last_refreshed_at: new Date().toISOString(),
    display_name: tw.name ?? null,
    profile_picture: tw.profilePicture ?? null,
    followers_count: Number(tw.followers ?? 0),
    following_count: Number(tw.following ?? 0),
    statuses_count: Number(tw.statusesCount ?? 0),
  };

  const { data, error } = await supabaseAdmin
    .from("x_accounts")
    .upsert(upsertPayload, { onConflict: "handle" })
    .select("id, handle, display_name, profile_picture")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// --- Public Actions ---

export async function getFollowedAccounts(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_x_follows')
    .select('x_account_id, x_accounts(handle, display_name, profile_picture)')
    .eq('user_id', userId);

  if (error) return [];
  
  return data.map((row: any) => ({
    id: row.x_account_id,
    handle: row.x_accounts?.handle,
    display_name: row.x_accounts?.display_name,
    profile_picture: row.x_accounts?.profile_picture,
  }));
}

export async function followAccount(userId: string, rawHandle: string) {
  try {
    await assertFollowRateLimit(userId);
    const acc = await ensureXAccountWithLookup(rawHandle);

    const { error } = await supabaseAdmin
      .from('user_x_follows')
      .upsert(
        { user_id: userId, x_account_id: acc.id },
        { onConflict: 'user_id,x_account_id' }
      );

    if (error) throw new Error(error.message);
    revalidatePath('/test');
    return { success: true, data: acc };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function unfollowAccount(userId: string, handle: string) {
  try {
    // Get Account ID first
    const { data: acct } = await supabaseAdmin
      .from('x_accounts')
      .select('id')
      .eq('handle', normHandle(handle))
      .single();

    if (!acct) throw new Error("Account not found");

    const { error } = await supabaseAdmin
      .from('user_x_follows')
      .delete()
      .eq('user_id', userId)
      .eq('x_account_id', acct.id);

    if (error) throw new Error(error.message);
    
    revalidatePath('/test');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}