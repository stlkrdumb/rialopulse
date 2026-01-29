const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection } = require("@solana/web3.js");
const { HermesClient } = require("@pythnetwork/hermes-client");
// Removed PythSolanaReceiver to avoid dependency conflicts (rpc-websockets version mismatch)
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Configuration
// In production, load this from environment variables or a keyfile
const PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
const PROGRAM_ID = "a1fq1EhzvH6dPwDgcaRwAzo6BF5NgMWR27SUAyFzqPX";
const WALLET_PATH = process.env.ANCHOR_WALLET || "/home/rai/.config/solana/id.json";
const PYTH_HERMES_URL = "https://hermes.pyth.network";
const PYTH_RECEIVER_PROGRAM_ID = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1iqJQ9");

async function main() {
    process.env.ANCHOR_PROVIDER_URL = PROVIDER_URL;
    process.env.ANCHOR_WALLET = WALLET_PATH;

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const idlPath = 'target/idl/solana_prediction_market.json';
    if (!fs.existsSync(idlPath)) {
        console.error("IDL not found at", idlPath);
        return;
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const program = new anchor.Program(idl, provider);

    // Initialize Hermes Client
    const hermes = new HermesClient(PYTH_HERMES_URL, {});

    console.log("🚀 Market Resolution Bot Started");
    console.log("Watching for expired markets... (polling every 60s)");

    const checkMarkets = async () => {
        try {
            // Fetch all markets
            const markets = await program.account.market.all();
            const now = Math.floor(Date.now() / 1000);
            console.log("Total markets found:", markets.length);
            console.log("Current time:", new Date(now * 1000).toISOString());

            let expiredFound = 0;

            for (const m of markets) {
                const market = m.account;
                const marketPubkey = m.publicKey;

                if (market.resolved) continue;

                if (market.endTime.toNumber() < now) {
                    expiredFound++;
                    console.log(`\nFound Expired Market: ${marketPubkey.toString()}`);
                    console.log(`- Asset: ${market.assetSymbol}`);
                    console.log(`- Question: ${market.question}`);
                    console.log(`- End Time: ${new Date(market.endTime.toNumber() * 1000).toISOString()}`);

                    try {
                        // Fetch price update from Pyth Hermes
                        const feedIdHex = Buffer.from(market.feedId).toString('hex');
                        const updateData = await hermes.getLatestPriceUpdates([feedIdHex]);

                        if (!updateData || !updateData.binary || !updateData.binary.data) {
                            console.error("Failed to fetch price update from Hermes");
                            continue;
                        }

                        console.log(`- Fetching Pyth price update proof...`);

                        // Calculate Price Update Account PDA manually
                        // Seeds: 'PriceUpdate', shard_id (u16 LE), feed_id
                        const shardId = 0; // Default shard ID
                        const shardIdBuf = Buffer.alloc(2);
                        shardIdBuf.writeUInt16LE(shardId, 0);

                        const [priceUpdateAccount] = PublicKey.findProgramAddressSync(
                            [
                                Buffer.from("PriceUpdate"),
                                shardIdBuf,
                                Buffer.from(market.feedId) // feedId is already array/buffer in account data
                            ],
                            PYTH_RECEIVER_PROGRAM_ID
                        );

                        console.log(`- Resolving using Price Update Account: ${priceUpdateAccount.toString()}`);

                        // Note: In a real environment, we need to submit the 'postUpdate' instruction 
                        // (which writes the hermes update to the priceUpdateAccount) BEFORE resolving.
                        // This requires constructing the transaction with the wormhole VAA.
                        // Since we removed the SDK due to conflicts, we are just printing the plan here.
                        // In Devnet, if the price account is already updated by someone else, we could just resolve.

                        // If we had the SDK running, we would do:
                        /*
                        const tx = await program.methods.resolveMarket()
                           .accounts({
                               market: marketPubkey,
                               priceUpdate: priceUpdateAccount,
                           })
                           // .preInstructions([pythReceiver.postUpdateInstruction(...)])
                           .rpc();
                        */

                        // Try to resolve assuming price is updated (or just to fail cleanly if not)
                        try {
                            // Extract price from Hermes update
                            // Use the first update (we requested one feed)
                            const priceUpdate = updateData.parsed?.[0]?.price?.price;
                            if (!priceUpdate) throw new Error("No parsed price in Hermes update");

                            const finalPrice = new anchor.BN(priceUpdate);
                            console.log(`- Final Price: ${finalPrice.toString()}`);

                            const tx = await program.methods.resolveMarket(finalPrice)
                                .accounts({
                                    market: marketPubkey,
                                    priceUpdate: priceUpdateAccount,
                                })
                                .rpc();
                            console.log(`- ✅ Successfully resolved: ${tx}`);
                        } catch (e) {
                            console.log(`- ⚠️ Resolution tx failed (likely need to post price update first): ${e.message}`);
                        }

                    } catch (err) {
                        console.error(`Error processing market ${marketPubkey.toString()}:`, err);
                    }
                } else {
                    // Market not expired yet
                    const timeUntilExpiry = market.endTime.toNumber() - now;
                    const minutesRemaining = Math.floor(timeUntilExpiry / 60);
                    console.log(`- Active market "${market.question}" expires in ${minutesRemaining} mins`);
                }
            }

            if (expiredFound === 0) {
                // process.stdout.write("."); // heartbeat
            }
        } catch (err) {
            console.error("Error in poll loop:", err);
        }
    };

    // Run immediately then every 2 minutes (to avoid rate limits)
    await checkMarkets();
    setInterval(checkMarkets, 120000);
}

// Keep process alive
main().catch(err => {
    console.error(err);
    process.exit(1);
});
