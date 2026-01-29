import { HermesClient } from '@pythnetwork/hermes-client';
import { Connection, PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';

// Hermes endpoint for fetching price updates
const HERMES_URL = 'https://hermes.pyth.network';
const hermesClient = new HermesClient(HERMES_URL);

// Pyth Solana Receiver Program ID (same for mainnet and devnet)
export const PYTH_RECEIVER_PROGRAM_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ');

// Pyth price feed IDs for Devnet/Mainnet
export const PYTH_FEED_IDS = {
    BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
};

/**
 * Convert hex string to [u8; 32] array for Solana program
 */
export function hexToFeedId(hexString) {
    const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

/**
 * Convert [u8; 32] array back to hex string
 */
export function feedIdToHex(feedIdArray) {
    return '0x' + feedIdArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch latest price update from Hermes (off-chain)
 */
export async function getPriceUpdate(feedIdHex) {
    try {
        const priceUpdates = await hermesClient.getLatestPriceUpdates([feedIdHex]);
        return priceUpdates.parsed?.[0] || null;
    } catch (error) {
        console.error('Error fetching price update from Hermes:', error);
        throw error;
    }
}

/**
 * Get current price for display (off-chain only)
 */
export async function getCurrentPrice(feedIdHex) {
    const priceData = await getPriceUpdate(feedIdHex);
    if (!priceData || !priceData.price) {
        throw new Error('No price data available');
    }

    return {
        price: Number(priceData.price.price),
        conf: Number(priceData.price.conf),
        expo: priceData.price.expo,
    };
}

/**
 * Format price for display (accounting for exponent)
 */
export function formatPrice(price, expo) {
    const actualPrice = price * Math.pow(10, expo);
    return actualPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Get asset name from feed ID
 */
export function getAssetFromFeedId(feedIdHex) {
    for (const [asset, id] of Object.entries(PYTH_FEED_IDS)) {
        if (id.toLowerCase() === feedIdHex.toLowerCase()) {
            return asset;
        }
    }
    return 'Unknown';
}

/**
 * Get or use existing Pyth price update account (PDA)
 * For simplicity, we use the treasury account which contains multiple price feeds
 * The smart contract will read the price based on feed_id
 */
export async function getOrCreatePriceUpdateAccount(connection, wallet, feedIdHex) {
    // For Pyth Receiver program on Solana, there are shared price update accounts
    // We can use the treasury/shared account that contains multiple feeds
    // The actual account depends on which shard the feed is in

    // Get feed ID bytes
    const feedIdBytes = hexToFeedId(feedIdHex);

    // Calculate the shard (Pyth uses multiple treasury accounts)
    // For simplicity, we'll use the first shard's treasury account
    // In production, you'd calculate which shard based on feed_id

    // Treasury 0 PDA
    const [treasuryAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('treasury'), Buffer.from([0])],
        PYTH_RECEIVER_PROGRAM_ID
    );

    try {
        // Check if treasury exists
        const accountInfo = await connection.getAccountInfo(treasuryAccount);

        if (accountInfo) {
            console.log('Using Pyth treasury account:', treasuryAccount.toString());
            return treasuryAccount;
        }
    } catch (error) {
        console.warn('Error checking treasury:', error);
    }

    // If treasury doesn't exist, we need to use a different approach
    // For Devnet testing, let's use a known Pyth price feed account
    // This is the BTC/USD price account on Pyth (this contains aggregated prices)

    // Alternative: Use the known price feed account for the specific asset
    // These are the aggregated price accounts maintained by Pyth
    const PYTH_PRICE_ACCOUNTS = {
        // These are actual Pyth v2 price accounts on Devnet
        BTC: new PublicKey('HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J'), // BTC/USD
        ETH: new PublicKey('EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw'), // ETH/USD  
        SOL: new PublicKey('J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix'), // SOL/USD
    };

    const asset = getAssetFromFeedId(feedIdHex);
    const priceAccount = PYTH_PRICE_ACCOUNTS[asset];

    if (priceAccount) {
        console.log(`Using Pyth ${asset}/USD price account:`, priceAccount.toString());
        return priceAccount;
    }

    // Fallback to the treasury account even if it doesn't exist
    // The transaction will fail with a better error message
    console.warn('Could not find price account, using treasury as fallback');
    return treasuryAccount;
}
