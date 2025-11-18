import { type WalletWithMetadata,
    type LinkedAccountWithMetadata, } from '@privy-io/react-auth';

export type GammaMarket = {
  id: string;
  question: string;
  conditionId: string;
  outcomes: string;        // '["Yes","No"]'
  clobTokenIds: string;    // '["yesId","noId"]'
  orderPriceMinTickSize: number;
  orderMinSize: number;
  bestBid?: number;
  bestAsk?: number;
  lastTradePrice?: number;
  slug: string;
};

export function isEmbeddedEvmWallet(account: LinkedAccountWithMetadata): account is WalletWithMetadata & { chainType: 'ethereum' } {
    return account.type === 'wallet'
        && account.connectorType === 'embedded'
        && account.chainType === 'ethereum';
}

/**
 * Checks if a linked account is an external wallet (e.g., MetaMask, Phantom).
 */
export function isExternalWallet(account: LinkedAccountWithMetadata): account is WalletWithMetadata {
    return account.type === 'wallet' && account.connectorType !== 'embedded';
}

/**
 * Checks if a linked account is a Privy-provided embedded Solana wallet.
 */
export function isEmbeddedSolanaWallet(account: LinkedAccountWithMetadata): account is WalletWithMetadata & { chainType: 'solana' } {
    return account.type === 'wallet'
        && account.connectorType === 'embedded'
        && account.chainType === 'solana';
}

/**
 * Checks if a linked account is a Twitter/X social profile.
 */
export function isTwitterAccount(account: LinkedAccountWithMetadata): account is LinkedAccountWithMetadata & { type: 'twitter_oauth' } {
    return account.type === 'twitter_oauth';
}


// app/events/[slug]/event-data.ts
export type NormalizedOutcome = {
  label: string;                 // "Yes" | "No" | custom
  tokenId: string;               // CLOB token id (stringified bigint)
  price?: number;                // last known price if present (0..1)
};

// event-data.ts (only the relevant parts changed)
export type NormalizedMarket = {
  id: string;
  slug: string;
  question: string;
  conditionId?: string;
  acceptingOrdersTs?: number;   // unix seconds
  closedAtTs?: number;          // unix seconds (if closed)
  closed?: boolean;
  outcomes: NormalizedOutcome[];
};

export type NormalizedEvent = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  icon?: string;
  tags?: string[];
  markets: NormalizedMarket[];
};
