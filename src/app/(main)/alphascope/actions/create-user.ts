"use server"
import privyClient from '@/lib/privy/server';
import supabaseAdmin from '@/lib/supabase/server';
import { isEmbeddedEvmWallet, isEmbeddedSolanaWallet, isExternalWallet, isTwitterAccount } from '@/types/polymarket';

import {
    type User,
    type WalletWithMetadata,
    type LinkedAccountWithMetadata,
} from '@privy-io/react-auth';


export const createUser = async (user: User, accessToken: string) => {
    try {
        // 1. Verify the access token is valid and for the right user
        const verifiedClaims = await privyClient.verifyAuthToken(accessToken);
        if (verifiedClaims.userId !== user.id) {
            throw new Error("User ID mismatch. Invalid token.");
        }

        // --- Intelligent Data Extraction using Type Guards ---

        const externalWallet = user.linkedAccounts.find(isExternalWallet);
        const embeddedEvmWallet = user.linkedAccounts.find(isEmbeddedEvmWallet);
        const embeddedSolanaWallet = user.linkedAccounts.find(isEmbeddedSolanaWallet);
        const twitterAccount = user.linkedAccounts.find(isTwitterAccount);

        // --- Database Upsert Operation ---
        // .upsert() inserts if the user is new, and updates if they already exist.
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: user.id, // The Privy DID is the primary key
                username: twitterAccount?.username,
                avatar_url: twitterAccount?.profilePictureUrl,
                main_wallet: externalWallet?.address, // The user's own wallet
                evm_address: embeddedEvmWallet?.address, // The app's embedded wallet
                solana_address: embeddedSolanaWallet?.address, // The app's embedded wallet
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase upsert error:", error);
            throw error;
        }

        console.log("Successfully created/synced user profile:", data.id);
        return { success: true, profile: data };

    } catch (error) {
        console.error("Error in createUser:", error);
        return { success: false, error: (error as Error).message };
    }
};