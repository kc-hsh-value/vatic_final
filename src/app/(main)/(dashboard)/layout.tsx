"use client"

import React, { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/spinner';
import { getAccessToken, useLogin, usePrivy, useSessionSigners } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { isEmbeddedEvmWallet } from '@/types/polymarket';

import ReactQueryProvider from '@/providers/query-provider';
import VaticUserProvider from '@/providers/vatic-user-provider';
import { checkAccessCookie } from '../auth/actions/gate';
import { getProvisioningStatus } from '../alphascope/actions/get-provisioning-status';
import { createUser } from '../alphascope/actions/create-user';
import { markHasSessionSigner } from '../alphascope/actions/update-flags';
import { ensureOnchainAndClob } from '../alphascope/actions/ensure-allowances-and-clob-credentials';
import ReadyLoader from '../alphascope/components/ready-loader';
import GateScreen from '../auth/components/gate-screen';
import LoginScreen from '../alphascope/components/login-screen';
import NewNavbar from '../alphascope/components/new-navbar';


interface LayoutProps {
    children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    const {ready, authenticated} = usePrivy()
    
    // Auth Flow States
    const [hasBetaAccess, setHasBetaAccess] = useState<boolean | null>(null); // null = loading check
    const [profileSetupLoading, setProfileSetupLoading] = React.useState(false)
    const [loadingMessage, setLoadingMessage] = React.useState("Setting up your profile...");
    
    const {addSessionSigners} = useSessionSigners()

    // 1. CHECK FOR BETA COOKIE ON MOUNT
    useEffect(() => {
        const checkAccess = async () => {
            const allowed = await checkAccessCookie();
            setHasBetaAccess(allowed);
        };
        checkAccess();
    }, []);

    // 2. STANDARD PRIVY LOGIN FLOW
    const { login } = useLogin({
        onComplete: async ({ user }) => {
            // ... (YOUR EXACT PROVISIONING CODE GOES HERE) ...
            const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

            try {
                setProfileSetupLoading(true);
                setLoadingMessage("Initializing session..."); 
                const accessToken = await getAccessToken();
                if (!accessToken) throw new Error("No access token");

                toast.info("Checking your vatic profile...");
                let status = await getProvisioningStatus(user.id);

                if (!status.exists) {
                    setLoadingMessage("Creating your secure profile...");
                    const created = await createUser(user, accessToken);
                    if (!created?.success) throw new Error("Failed to create profile");
                    status = await getProvisioningStatus(user.id);
                }

                const embedded = user.linkedAccounts.find(isEmbeddedEvmWallet);
                if (!embedded) throw new Error("No embedded EVM wallet found");

                if (!status.signers_added) {
                    setLoadingMessage("Waiting for trade approval..."); 
                    const quorumId = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID!;
                    try {
                        await addSessionSigners({
                            address: embedded.address,
                            signers: [{ signerId: quorumId, policyIds: [] }],
                        });
                        await markHasSessionSigner(user.id);
                        status.signers_added = true;
                        toast.success("Trading session approved!");
                        setLoadingMessage("Finalizing setup...");
                        await sleep(2000); 
                    } catch (e: any) {
                        const msg = String(e?.message || "");
                        if (/already.*(delegated|signer)/i.test(msg)) {
                            await markHasSessionSigner(user.id);
                            status.signers_added = true;
                        } else {
                            throw e; 
                        }
                    }
                }

                if (!status.hasAllowances || !status.hasClobCreds) {
                    setLoadingMessage("Deploying your on-chain trading wallet...");
                    const maxRetries = 3;
                    for (let i = 1; i <= maxRetries; i++) {
                        try {
                            if (i > 1) setLoadingMessage(`Retrying wallet setup (${i}/${maxRetries})...`);
                            if(!embedded.id) throw new Error("No embedded EVM wallet ID found");
                            await ensureOnchainAndClob({
                                userId: user.id,
                                walletId: embedded.id,
                                eoaAddress: embedded.address as `0x${string}`,
                                chainId: 137,
                            });
                            break; 
                        } catch (err) {
                            if (i === maxRetries) throw err;
                            await sleep(1500);
                        }
                    }
                }

                setProfileSetupLoading(false);
                setLoadingMessage("Setup complete!"); 
                toast.success("Welcome to Vatic.");

            } catch (err: any) {
                console.error("Provisioning failed:", err);
                toast.error("Setup failed. Please refresh.", { description: err.message });
                setProfileSetupLoading(false);
            }
        },
        onError: (e) => console.log("Privy login error:", e),
    });

    // 3. RENDER LOGIC

    // A. Wait for Privy + Cookie Check
    if(!ready || hasBetaAccess === null) {
        return <ReadyLoader/>
    }

    // B. Unauthenticated State handling
    if(ready && !authenticated) {
        
        // Gate: If no cookie, force them to enter code
        if (!hasBetaAccess) {
            return (
                <GateScreen onAccessGranted={() => setHasBetaAccess(true)} />
            )
        }

        // Login: If they passed gate (cookie or just now), show Login Screen
        return (
            <LoginScreen onLoginClick={login} />
        )
    }

    // C. Authenticated & Provisioning State
    if(ready && authenticated) {
        if (profileSetupLoading) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-black text-white">
                    <Spinner className="size-8"/>
                    <p className="text-lg font-medium">{loadingMessage}</p>
                    <p className="text-sm text-white/60">This may take 2-3 minutes. Please wait.</p>
                </div>
            )
        }
        
        // D. Main App
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

export default Layout