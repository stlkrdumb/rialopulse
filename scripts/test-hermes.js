const { HermesClient } = require('@pythnetwork/hermes-client');

async function val() {
    console.log("Testing Hermes Client...");
    const client = new HermesClient("https://hermes.pyth.network");
    const solFeed = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

    try {
        console.log(`Fetching updates for ${solFeed}...`);
        const updates = await client.getLatestPriceUpdates([solFeed], {
            encoding: "base64",
            parsed: true
        });

        console.log("Full Response:", JSON.stringify(updates, null, 2));
        console.log("Binary Data Length:", updates.binary?.[0]?.data?.length);
        console.log("Price:", updates.parsed?.[0]?.price?.price);
    } catch (e) {
        console.error("Failed:", e);
    }
}

val();
