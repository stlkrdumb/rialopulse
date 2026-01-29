import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaPredictionMarket } from "../target/types/solana_prediction_market";
import { expect } from "chai";

describe("solana-prediction-market", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaPredictionMarket as Program<SolanaPredictionMarket>;

  const marketKeypair = anchor.web3.Keypair.generate();
  const priceFeedKeypair = anchor.web3.Keypair.generate(); // Mock Feed

  const asset = "BTC";
  const duration = new anchor.BN(2); // 2 seconds for quick test

  let vaultPda: anchor.web3.PublicKey;

  it("Initialize Mock Price Feed", async () => {
    const initialPrice = new anchor.BN(5000000000000); // $50,000 * 10^8 (Pyth style)
    const initialConf = new anchor.BN(100);

    await program.methods
      .initializeMockFeed(initialPrice, initialConf)
      .accounts({
        priceFeed: priceFeedKeypair.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([priceFeedKeypair])
      .rpc();

    const feedAccount = await program.account.mockPriceFeed.fetch(priceFeedKeypair.publicKey);
    expect(feedAccount.price.toString()).to.equal(initialPrice.toString());
  });

  it("Initialize Market", async () => {
    // Derive vault PDA
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeMarket(asset, duration)
      .accounts({
        market: marketKeypair.publicKey,
        priceFeed: priceFeedKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketKeypair])
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.assetSymbol).to.equal(asset);
    expect(marketAccount.resolved).to.be.false;
    // Verify start price was captured
    const feedAccount = await program.account.mockPriceFeed.fetch(priceFeedKeypair.publicKey);
    expect(marketAccount.startPrice.toString()).to.equal(feedAccount.price.toString());
  });

  const betKeypair1 = anchor.web3.Keypair.generate(); // Up bet
  const betKeypair2 = anchor.web3.Keypair.generate(); // Down bet 

  it("Place Bet UP", async () => {
    const amount = new anchor.BN(1_000_000_000); // 1 SOL

    await program.methods
      .placeBet(true, amount)
      .accounts({
        bet: betKeypair1.publicKey,
        market: marketKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([betKeypair1])
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.totalUpPool.toString()).to.equal(amount.toString());
  });

  it("Place Bet DOWN", async () => {
    const amount = new anchor.BN(500_000_000); // 0.5 SOL

    await program.methods
      .placeBet(false, amount)
      .accounts({
        bet: betKeypair2.publicKey,
        market: marketKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([betKeypair2])
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.totalDownPool.toString()).to.equal(amount.toString());
  });

  it("Wait for market end", async () => {
    console.log("Waiting 3s for market to end...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it("Resolve Market (Update Price -> Resolve)", async () => {
    // Update price to be HIGHER than start (Winner = UP)
    const newPrice = new anchor.BN(5500000000000); // $55,000
    const conf = new anchor.BN(100);

    await program.methods
      .updateMockPrice(newPrice, conf)
      .accounts({
        priceFeed: priceFeedKeypair.publicKey
      })
      .rpc();

    await program.methods
      .resolveMarket()
      .accounts({
        market: marketKeypair.publicKey,
        priceFeed: priceFeedKeypair.publicKey,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.resolved).to.be.true;
    expect(marketAccount.outcome).to.be.true; // True = UP
  });

  it("Claim Winnings", async () => {
    // betKeypair1 was UP (Winner)
    const initialBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    console.log("Initial Balance:", initialBalance);

    await program.methods
      .claim()
      .accounts({
        bet: betKeypair1.publicKey,
        market: marketKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const betAccount = await program.account.bet.fetch(betKeypair1.publicKey);
    expect(betAccount.claimed).to.be.true;

    const finalBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    console.log("Final Balance:", finalBalance);
    expect(finalBalance).to.be.greaterThan(initialBalance); // Should have received payout
  });

  it("Fail to claim loser bet", async () => {
    try {
      await program.methods
        .claim()
        .accounts({
          bet: betKeypair2.publicKey,
          market: marketKeypair.publicKey,
          vault: vaultPda,
          user: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have failed");
    } catch (e) {
      expect(e).to.exist;
    }
  });

});
