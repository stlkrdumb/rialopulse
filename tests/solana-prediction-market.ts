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
  // We use a dummy account for price update since the program expects UncheckedAccount
  // and we are passing price manually in resolution in this version.
  const priceFeedKeypair = anchor.web3.Keypair.generate();

  const asset = "BTC";
  const duration = new anchor.BN(2); // 2 seconds
  const question = "Will BTC go above $50k?";
  const feedId = Array(32).fill(0);
  const initialPrice = new anchor.BN(5000000000000); // 50000.00
  const priceConf = new anchor.BN(100);
  const targetPrice = new anchor.BN(5500000000000); // 55000.00

  let vaultPda: anchor.web3.PublicKey;

  it("Initialize Market (Above/Standard)", async () => {
    // Derive vault PDA
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketKeypair.publicKey.toBuffer()],
      program.programId
    );

    const inverted = false;

    await program.methods
      .initializeMarket(question, asset, duration, feedId, initialPrice, priceConf, targetPrice, inverted)
      .accounts({
        market: marketKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketKeypair])
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.assetSymbol).to.equal(asset);
    expect(marketAccount.startPrice.toString()).to.equal(initialPrice.toString());
    expect(marketAccount.inverted).to.be.false;
  });

  const betKeypair1 = anchor.web3.Keypair.generate(); // Up bet

  it("Place Bet", async () => {
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
  });

  it("Wait for market end", async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  it("Resolve Market (Above Logic)", async () => {
    // Final price 60k > Target 55k -> Outcome YES (true)
    const finalPrice = new anchor.BN(6000000000000);

    await program.methods
      .resolveMarket(finalPrice)
      .accounts({
        market: marketKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketKeypair.publicKey);
    expect(marketAccount.resolved).to.be.true;
    expect(marketAccount.outcome).to.be.true;
  });


  // --- INVERTED MARKET TEST ---
  const marketInvertedKeypair = anchor.web3.Keypair.generate();
  const targetPriceInverted = new anchor.BN(4500000000000); // 45k target (current 50k)
  // Question: Will BTC go BELOW 45k?

  it("Initialize Inverted Market (Below)", async () => {
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketInvertedKeypair.publicKey.toBuffer()],
      program.programId
    );

    const inverted = true;

    await program.methods
      .initializeMarket("Will BTC go below 45k?", asset, duration, feedId, initialPrice, priceConf, targetPriceInverted, inverted)
      .accounts({
        market: marketInvertedKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketInvertedKeypair])
      .rpc();

    const marketAccount = await program.account.market.fetch(marketInvertedKeypair.publicKey);
    expect(marketAccount.inverted).to.be.true;
  });

  it("Resolve Inverted Market (Fail case)", async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Final Price 48k. Target 45k.
    // Inverted logic: 48k < 45k is FALSE. Outcome should be NO (false).
    const finalPrice = new anchor.BN(4800000000000);

    await program.methods
      .resolveMarket(finalPrice)
      .accounts({
        market: marketInvertedKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketInvertedKeypair.publicKey);
    expect(marketAccount.outcome).to.be.false;
  });

  const marketInvertedWinKeypair = anchor.web3.Keypair.generate();

  it("Resolve Inverted Market (Win case)", async () => {
    // Create another market for win case
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketInvertedWinKeypair.publicKey.toBuffer()],
      program.programId
    );
    const inverted = true;

    await program.methods
      .initializeMarket("Will BTC go below 45k?", asset, duration, feedId, initialPrice, priceConf, targetPriceInverted, inverted)
      .accounts({
        market: marketInvertedWinKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
        vault: vaultPda,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketInvertedWinKeypair])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Final Price 40k. Target 45k.
    // Inverted logic: 40k < 45k is TRUE. Outcome should be YES (true).
    const finalPrice = new anchor.BN(4000000000000);

    await program.methods
      .resolveMarket(finalPrice)
      .accounts({
        market: marketInvertedWinKeypair.publicKey,
        priceUpdate: priceFeedKeypair.publicKey,
      })
      .rpc();

    const marketAccount = await program.account.market.fetch(marketInvertedWinKeypair.publicKey);
    expect(marketAccount.outcome).to.be.true;
  });

});
