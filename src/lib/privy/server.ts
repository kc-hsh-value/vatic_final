// lib/privy.ts
import { PrivyClient } from '@privy-io/server-auth';

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  throw new Error('Missing Privy environment variables');
}

const privyClient = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET,
    {timeout:30000}
);


// Verifies the access token you got on the client with getAccessToken()
export async function verifyPrivyAccessToken(accessToken: string) {
  if (!accessToken) throw new Error('Missing Privy access token');
  console.log("accessToken: ",accessToken)

  // Validate the token; returns claims incl. user id (sub)
  const claims = await privyClient.verifyAuthToken(accessToken);
  console.log("claims: ",claims)
  // claims.sub is the Privy user ID (e.g., did:privy:xxx)
  return { userId: claims.userId as string };
}

export default privyClient;