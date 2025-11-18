// /server/lib/polymarket/builder-config.ts
import { BuilderConfig, BuilderApiKeyCreds } from "@polymarket/builder-signing-sdk";

// Helper function to safely load builder config from environment variables
export function getBuilderConfig(): BuilderConfig {
    const key = process.env.POLYMARKET_BUILDERS_API_KEY;
    const secret = process.env.POLYMARKET_BUILDERS_SECRET;
    const passphrase = process.env.POLYMARKET_BUILDERS_PASSPHRASE;

    if (!key || !secret || !passphrase) {
        throw new Error("Missing Polymarket Builder API credentials in environment variables (POLYMARKET_BUILDERS_API_KEY, POLYMARKET_BUILDERS_SECRET, or POLYMARKET_BUILDERS_PASSPHRASE)");
    }

    const builderCreds: BuilderApiKeyCreds = {
      key,
      secret,
      passphrase,
    };

    return new BuilderConfig({
      localBuilderCreds: builderCreds
    });
}