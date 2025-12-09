# Vatic Trading: Authentication & User State Architecture

## Part 1: The Authentication & Onboarding Process

### 1.1. High-Level Overview & Core Principles

The user journey from landing to being "trade-ready" involves a hybrid on-chain and off-chain setup. The core principle is the **separation of concerns** between a user's master key and their trading funds.

1.  **Authentication (Privy):** The user connects with their X account. Privy generates a unique **EOA (Externally Owned Account)**. This EOA acts as the user's **Controller** or **Signer**.
2.  **On-Chain Setup (Gnosis Safe):** We deploy a **Safe Wallet** (a Gnosis Safe smart contract) to the Polygon network. This wallet is the **Fund Holder** or **Vault**, and its sole owner is the user's EOA.
3.  **Funding:** The user must deposit USDC.e directly into their **Safe Wallet address**. Funds sent to the EOA are inaccessible for trading.
4.  **Permissions (Relayer):** All token approvals are granted *to the Safe Wallet*. The EOA simply signs messages authorizing the Polymarket Relayer to execute these on-chain actions, making them gasless for the user.

| Component | Role | Who Pays Gas? | Key Interaction |
| :--- | :--- | :--- | :--- |
| **Privy EOA** | **Controller / Signer** | (User, for non-relayed actions) | Signs off-chain CLOB orders & on-chain Safe Wallet transactions. |
| **Safe Wallet** | **Fund Holder / Vault** | N/A (It's a contract) | Holds USDC.e and executes transactions authorized by the EOA. |
| **Polymarket Relayer** | **Executor / Gas Payer** | **Polymarket** | Executes transactions on behalf of the Safe Wallet. |

### 1.2. Technical Implementation in `app/alphascope/layout.tsx`

The `layout.tsx` file is the entry point and orchestrator for the entire onboarding flow.

1.  **State Management:**
    *   `usePrivy()` hook provides `ready` and `authenticated` flags.
    *   `profileSetupLoading` and `loadingMessage` are local `useState` variables that control the UI during the onboarding sequence.

2.  **`useLogin()` Hook & The `onComplete` Callback:**
    This is the heart of the process, triggered immediately after a successful Privy login.

    *   **Step 1: Profile Creation**
        *   Checks our Supabase `profiles` table for an existing user.
        *   If the user is new, `createUser` is called to create their profile.
    *   **Step 2: Session Signer Approval**
        *   Prompts the user via a Privy modal to delegate signing authority.
        *   **Crucial:** A **2-second `sleep`** is implemented after this step to prevent a race condition by allowing the new signer to propagate across Privy's backend.
    *   **Step 3: On-Chain Setup (`ensureOnchainAndClob`)**
        *   This server action is called to handle all on-chain and CLOB-related tasks.
        *   It is wrapped in a **retry loop (3 attempts)** to handle transient network errors or propagation delays.
        *   **Inside `ensureOnchainAndClob`:**
            1.  The user's deterministic **Safe Wallet address** is calculated.
            2.  The backend checks if the contract is deployed on-chain. If not, the **Relayer Client** is used to deploy it gaslessly.
            3.  The **Relayer Client** is then used again to execute a batch of token approval transactions *from the Safe Wallet*.
            4.  Finally, the **CLOB Client** is used to generate API credentials. **These credentials are for the EOA**, as it is the account that signs off-chain orders.

---

## Part 2: Post-Authentication: Managing User State

Once the `onComplete` flow finishes, the main application renders. The state is managed by two providers wrapping the `children`.

### 2.1. The Provider Stack

1.  **`<ReactQueryProvider>`:** Manages all asynchronous "server state."
    *   **Function:** Handles data fetching, caching, background refetching, and retries.
    *   **Primary Use Case:** Powers the 15-second `pollBalances` function to keep the user's financial data fresh.

2.  **`<VaticUserProvider>`:** Populates our global "client state" store.
    *   **Function:** Fetches user data from both the Privy `user` object and our Supabase database, then injects it into the Zustand store.
    *   **Key Logic:** It uses `useEffect` hooks to sync data whenever the Privy user object changes or when `useQuery` fetches new data from the database.

### 2.2. The Zustand Store (`use-vatic-store.ts`)

This is the "single source of truth" for all user-related data in the UI. Any component can access this store to get the latest information.

*   **`Provision` Slice:** A set of booleans (`signersAdded`, `hasAllowances`, `safeWalletDeployed`, `hasClobCreds`) that track the user's onboarding progress. The `setupComplete` flag is a derived value from these booleans.
*   **`EOAWallet` Slice:** Holds the `address` and `walletId` of the user's Privy EOA. Essential for any action that requires a signature.
*   **`SafeWallet` Slice:** Holds the `address` and financial data (`balanceUSDC`, `lockedUSDC`, `positionsValue`) for the user's on-chain trading vault. This is the data displayed in the navbar.
*   **Other Slices:** `Auth` and `Identity` hold basic user info.

---

### 2.3. Data Flow Summary

This is the path data takes to get to the UI:

1.  **Login:** Privy provides the `user` object.
2.  **`VaticUserProvider`:** The `initFromPrivy` action is called, populating the `EOAWallet` and `Identity` slices in the Zustand store.
3.  **`VaticUserProvider`:** `useQuery` fetches the user's profile from Supabase.
4.  **`VaticUserProvider`:** The `setProvision` and `setSafeWallet` actions are called, populating the remaining slices in the store.
5.  **`NewNavbar.tsx` (or any other component):** The `useVaticUser()` hook reads the fully populated data from the Zustand store and displays it.
6.  **Polling (`pollBalances`):** Every 15 seconds, `useQuery` re-fetches balance data, which triggers `setSafeWallet` again, automatically updating the UI with the latest values.

---

### 2.4. Developer Insights

> **On-Chain Doxxing:** As discovered during development, the deterministic nature of Gnosis Safe deployments means one can calculate a user's Polymarket Safe Wallet address using only their public EOA address. This is a powerful tool for on-chain analysis and tracking the activity of known wallets.