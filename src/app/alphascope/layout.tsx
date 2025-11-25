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
    const {addSessionSigners} = useSessionSigners()
    const {login} = useLogin({
        onComplete: async ({ user }) => {
            try {
                setProfileSetupLoading(true)
                const accessToken = await getAccessToken();
                toast("Event has been created", {
                    description: "Performing account provisioning...",
                    action: {
                        label: "Undo",
                        onClick: () => console.log("Undo"),
                    },
                })
                if (!accessToken) {
                    toast("Couldn't find access token")
                    setProfileSetupLoading(false)
                    throw new Error("No access token")
                };

                // 1) What do we already have?
                let status = await getProvisioningStatus(user.id);

                // 2) Ensure profile exists
                if (!status.exists) {
                    const created = await createUser(user, accessToken);
                    if (!created?.success) {
                        setProfileSetupLoading(false)
                        toast("failed to create a profile")
                        throw new Error("createUser failed")
                    };
                    toast("successfully created profile")
                    status = await getProvisioningStatus(user.id);
                }

                // 3) Ensure session signer (client-side)
                const embedded = user.linkedAccounts.find(isEmbeddedEvmWallet);
                if (!embedded) {
                    setProfileSetupLoading(false)
                    toast("an error with wallet occured please refresh")
                    throw new Error("No embedded EVM wallet")
                }
                
                toast("almost finished configurating profile")
                // If Privy already marked this wallet as delegated, we’re done for signers
                const alreadyDelegated = (embedded as any).delegated === true;
                if (alreadyDelegated) {
                    if (!status.signers_added) {
                        const res = await markHasSessionSigner(user.id);
                    }
                    status = { ...status, signers_added: true };
                } else if (!status.signers_added) {
                    toast("handling allowances")
                    const quorumId = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID!;
                    if (!quorumId) throw new Error("Missing NEXT_PUBLIC_PRIVY_SIGNER_ID");
                    toast("step 1/3 complete")

                    try {
                        await addSessionSigners({
                            address: embedded.address,
                            signers: [{ signerId: quorumId, policyIds: [] }],
                        });
                        toast("step 2/3 complete")
                        await markHasSessionSigner(user.id);
                        toast("step 3/3 complete")
                        status = { ...status, signers_added: true };
                    } catch (e: any) {
                        setProfileSetupLoading(false)
                        // Idempotency: ignore "already delegated/has signer" errors
                        const msg = String(e?.message || "");
                        const code = e?.response?.status;
                        if (
                            code === 409 ||                          // conflict
                            /already.*(delegated|signer)/i.test(msg) // friendly match
                        ) {
                            await markHasSessionSigner(user.id);
                            status = { ...status, signers_added: true };
                        } else {
                            throw e;
                        }
                    }
                }


            // 4) - updated. Check for safe_wallet_address

            if(!status.hasSafeWallet){
                toast("Safe wallet not found in profile, creating one.")
                
            }

            // 4) Ensure allowances + CLOB creds on server (idempotent)
            if ((!status.hasAllowances || !status.hasClobCreds) && embedded.id) {
                toast("ensuring allowances and clob creds")
                await ensureOnchainAndClob({
                    userId: user.id,
                    walletId: embedded.id,
                    eoaAddress: embedded.address as `0x${string}`,
                    chainId: 137,
                });
            }
            setProfileSetupLoading(false)
            toast("done")
            } catch (err) {
                console.error("Post-login provisioning failed:", err);
                setProfileSetupLoading(false)
            }
        },
        onError: (e) => console.log("Privy login error:", e),
    })

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
        if(profileSetupLoading) {

            console.log("profileSetupLoading")
            return (
                <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                    <Spinner className="size-8"/>
                    <p className="text-lg font-medium">Setting up your profile...</p>
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