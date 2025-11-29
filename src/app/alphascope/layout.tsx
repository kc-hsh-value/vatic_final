"use client"

import { Spinner } from '@/components/ui/spinner';
import { getAccessToken, useLogin, usePrivy, useSessionSigners } from '@privy-io/react-auth';
import React from 'react'
import ReadyLoader from './components/ready-loader';
import { toast } from 'sonner';
import { getProvisioningStatus } from './actions/get-provisioning-status';
import { createUser } from './actions/create-user';
import { isEmbeddedEvmWallet } from '@/types/polymarket';
import { markHasSessionSigner } from './actions/update-flags';
import { ensureOnchainAndClob } from './actions/ensure-allowances-and-clob-credentials';
import LoginScreen from './components/login-screen';
import ReactQueryProvider from '@/providers/query-provider';
import VaticUserProvider from '@/providers/vatic-user-provider';
import NewNavbar from './components/new-navbar';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    const {ready, authenticated} = usePrivy()
    const [profileSetupLoading, setProfileSetupLoading] = React.useState(false)
    const [loadingMessage, setLoadingMessage] = React.useState("Setting up your profile...");
    const {addSessionSigners} = useSessionSigners()

    const { login } = useLogin({
        onComplete: async ({ user }) => {
            // A simple helper function for delays
            const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

            try {
                setProfileSetupLoading(true);
                setLoadingMessage("Initializing session..."); // Initial message
                const accessToken = await getAccessToken();
                if (!accessToken) throw new Error("No access token");

                toast.info("Checking your vatic profile...");
                setLoadingMessage("Checking vatic profile...");
                let status = await getProvisioningStatus(user.id);

                // 1) Ensure profile exists
                if (!status.exists) {
                    toast.info("Creating your profile...");
                    setLoadingMessage("Creating your secure profile...");
                    const created = await createUser(user, accessToken);
                    if (!created?.success) throw new Error("Failed to create profile");
                    status = await getProvisioningStatus(user.id);
                }

                // 2) Ensure session signer (client-side)
                const embedded = user.linkedAccounts.find(isEmbeddedEvmWallet);
                if (!embedded) throw new Error("No embedded EVM wallet found");

                if (!status.signers_added) {
                    toast.info("Approving the request to enable trading...");
                    setLoadingMessage("Waiting for trade approval..."); // User sees this while Privy modal is open
                    const quorumId = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID!;
                    try {
                        await addSessionSigners({
                            address: embedded.address,
                            signers: [{ signerId: quorumId, policyIds: [] }],
                        });
                        await markHasSessionSigner(user.id);
                        status.signers_added = true;
                        toast.success("Trading session approved!");
                        setLoadingMessage("Approval confirmed. Finalizing setup..."); // New message after approval
                        // IMPORTANT: Add a small delay here to allow for propagation
                        await sleep(2000); // Wait 2 seconds
                    } catch (e: any) {
                        // Your existing idempotency check is great
                        const msg = String(e?.message || "");
                        if (/already.*(delegated|signer)/i.test(msg)) {
                            await markHasSessionSigner(user.id);
                            status.signers_added = true;
                        } else {
                            throw e; // Re-throw other errors
                        }
                    }
                }

                // 3) Ensure allowances + CLOB creds with a retry loop
                if (!status.hasAllowances || !status.hasClobCreds) {
                    toast.info("Setting up your on-chain trading wallet...");
                    setLoadingMessage("Deploying your on-chain trading wallet...");
                    let success = false;
                    const maxRetries = 3;
                    for (let i = 1; i <= maxRetries; i++) {
                        try {
                            if (i > 1) {
                                setLoadingMessage(`Wallet setup taking longer than usual... (Attempt ${i}/${maxRetries})`);
                            }
                            if(!embedded.id) {
                                throw new Error("No embedded EVM wallet ID found");
                            }
                            await ensureOnchainAndClob({
                                userId: user.id,
                                walletId: embedded.id,
                                eoaAddress: embedded.address as `0x${string}`,
                                chainId: 137,
                            });
                            success = true;
                            break; // Exit the loop on success
                        } catch (err) {
                            console.warn(`Attempt ${i} to setup on-chain wallet failed.`, err);
                            if (i === maxRetries) {
                            // If it's the last attempt, re-throw the error to be caught below
                            throw err;
                            }
                            // Wait before retrying
                            await sleep(1500);
                        }
                    }
                }

                setProfileSetupLoading(false);
                setLoadingMessage("Setup complete!"); // Final success message
                toast.success("Setup complete! Welcome to vatic.");

            } catch (err: any) {
                console.error("Post-login provisioning failed:", err);
                // Give a more helpful error message
                toast.error("Setup failed. Please refresh and try again.", {
                    description: err.message || "An unknown error occurred.",
                });
                setLoadingMessage("An error occurred. Please refresh the page. "); // Update message on error
                setProfileSetupLoading(false);
            }
        },
        onError: (e) => console.log("Privy login error:", e),
    });
    if(!ready) {
        return (
            <ReadyLoader/>
        )
    }

    if(ready && !authenticated) {
        return (
            <LoginScreen onLoginClick={login} />
        )
    }
    if(ready && authenticated) {
        console.log("ready and authenticated")
        if (profileSetupLoading) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                    <Spinner className="size-8"/>
                    {/* Use the new state variable here */}
                    <p className="text-lg font-medium text-white/90">{loadingMessage}</p>
                    <p className="text-sm text-white/60">This may take up to a 2-3 minutes. Please do not close this window.</p>
                </div>
            )
        }
        if(!profileSetupLoading) {
            console.log("not profileSetupLoading")
            return (    
            <div>
                <ReactQueryProvider>
                    <VaticUserProvider>
                        <NewNavbar />
                        <div>
                            <iframe src="https://ticker.polymarket.com/embed?category=Breaking News&theme=dark&speed=0.5&showPrices=true" width="100%" height="44" style={{border: "none", overflow: "hidden", display: "block"}}></iframe>
                        </div>

                        {children}
                    </VaticUserProvider>
                </ReactQueryProvider>
            </div>
        )
        }
    }
    // return (
    //     <div>
    //         <p>Vatic Trading</p>
    //     </div>
    // )
}

export default Layout