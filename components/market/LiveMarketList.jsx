import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BN, web3 } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { feedIdToHex, getAssetFromFeedId, getOrCreatePriceUpdateAccount, getCurrentPrice } from '@/utils/pyth';

export default function LiveMarketList() {
    const { program } = useProgram();
    const wallet = useWallet();
    const { connection } = useConnection();
    const [userBets, setUserBets] = useState([]);
    const [markets, setMarkets] = useState([]);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'past'

    const fetchMarkets = async () => {
        try {
            if (!program) return;

            // Fetch all markets, but filter out old incompatible ones
            let allMarkets = [];
            try {
                allMarkets = await program.account.market.all();
            } catch (e) {
                // If there are old markets with incompatible struct layout, fetch individually
                console.warn("Some markets may have incompatible format:", e.message);
                // For now, just return empty array - old markets are incompatible
                allMarkets = [];
            }

            // Sort by creation time (assuming order matches fetch order or public key for now)
            // Ideally should sort by start_time if available
            setMarkets(allMarkets);
        } catch (e) {
            console.error("Failed to fetch markets", e);
        }
    };

    const fetchUserBets = async () => {
        if (!program || !wallet.publicKey) return;
        try {
            // Filter bets where the first 32 bytes (after 8 byte discriminator) match the user's public key
            // Bet struct: user (32), market (32), ...
            const bets = await program.account.bet.all([
                {
                    memcmp: {
                        offset: 8, // Discriminator
                        bytes: wallet.publicKey.toBase58(),
                    }
                }
            ]);
            setUserBets(bets);
        } catch (e) {
            console.error("Failed to fetch user bets", e);
        }
    };

    useEffect(() => {
        fetchMarkets();
        fetchUserBets();
        const interval = setInterval(() => {
            fetchMarkets();
            fetchUserBets();
        }, 10000); // 10s to avoid 429
        return () => clearInterval(interval);
    }, [program, wallet.publicKey]);

    // Filter markets based on activeTab
    const filteredMarkets = markets.filter(m => {
        if (activeTab === 'active') return !m.account.resolved;
        if (activeTab === 'past') return m.account.resolved;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'active' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                    Active Markets
                </button>
                <button
                    onClick={() => setActiveTab('past')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'past' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                    Past Markets
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 md:grid-cols-2 gap-4">
                {filteredMarkets.length === 0 && (
                    <p className="text-gray-500 col-span-full text-center py-10">
                        {activeTab === 'active' ? "No active markets found." : "No past markets found."}
                    </p>
                )}
                {filteredMarkets.map((m) => (
                    <MarketCard
                        key={m.publicKey.toString()}
                        account={m.account}
                        publicKey={m.publicKey}
                        connection={connection}
                        wallet={wallet}
                        userBets={userBets.filter(b => b.account.market.toString() === m.publicKey.toString())}
                    />
                ))}
            </div>
        </div>
    );
}

function MarketCard({ account, publicKey, connection, wallet, userBets = [] }) {
    const { program } = useProgram();
    const [amount, setAmount] = useState('0.1');

    const placeBet = async (direction) => {
        if (!wallet.publicKey) {
            toast.error("Please connect your wallet first!");
            return;
        }
        const betKeypair = web3.Keypair.generate();
        const vaultPda = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), publicKey.toBuffer()],
            program.programId
        )[0];

        try {
            await program.methods.placeBet(direction, new BN(parseFloat(amount) * 1000000000))
                .accounts({
                    bet: betKeypair.publicKey,
                    market: publicKey,
                    vault: vaultPda,
                    user: wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .signers([betKeypair])
                .rpc();
            toast.success("Bet Placed Successfully!");
        } catch (e) {
            console.error(e);
            toast.error("Bet Failed", {
                description: e.message || e.toString()
            });
        }
    };

    // Countdown Timer Logic
    const [timeLeft, setTimeLeft] = useState(0);
    const [isEnded, setIsEnded] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now() / 1000;
            const end = account.endTime.toNumber();
            const remaining = end - now;

            if (remaining <= 0) {
                setTimeLeft(0);
                setIsEnded(true);
            } else {
                setTimeLeft(remaining);
                setIsEnded(false);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [account.endTime]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    const resolve = async () => {
        if (!wallet.publicKey || !program) return;
        try {
            // Get feed ID hex from market account
            const feedIdHex = feedIdToHex(account.feedId);

            // Get or create Pyth price update account
            console.log('Fetching Pyth price update for resolution...');
            const priceUpdateAccount = await getOrCreatePriceUpdateAccount(
                connection,
                wallet,
                feedIdHex
            );
            console.log('Using price update account for resolution:', priceUpdateAccount.toString());

            // 2. Get the current price value (to pass as final price)
            console.log('Fetching current price for resolution...');
            const priceData = await getCurrentPrice(feedIdHex);

            const finalPrice = new BN(priceData.price);

            console.log('Using price update account for resolution:', priceUpdateAccount.toString());
            console.log('Final resolution price:', finalPrice.toString());

            await program.methods.resolveMarket(finalPrice)
                .accounts({
                    market: publicKey,
                    priceUpdate: priceUpdateAccount,
                })
                .rpc();
            toast.success("Market Resolved!", {
                description: `Final Price: $${(finalPrice.toNumber() / 1e8).toFixed(2)}`
            });
        } catch (e) {
            console.error(e);
            toast.error("Resolve Failed", {
                description: e.message || e.toString()
            });
        }
    };

    const claim = async (betPublicKey) => {
        if (!wallet.publicKey || !program) return;

        try {
            const vaultPda = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), publicKey.toBuffer()],
                program.programId
            )[0];

            await program.methods.claim()
                .accounts({
                    bet: betPublicKey,
                    market: publicKey,
                    vault: vaultPda,
                    user: wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .rpc();

            toast.success("Winnings Claimed!", {
                description: "Check your wallet balance."
            });
        } catch (e) {
            console.error("Claim failed", e);
            toast.error("Claim Failed", {
                description: e.message || e.toString()
            });
        }
    }

    // Find winning bets that haven't been claimed
    const winningBets = userBets.filter(bet => {
        if (!account.resolved) return false;
        if (bet.account.claimed) return false;
        // Check if bet direction matches outcome
        // account.outcome is a boolean (true = YES, false = NO)
        // However, in anchor optional might be returned differently, but typically it is the value straight up if active.
        // Based on IDL/Logic: outcome is Option<bool>.

        // Safety check if outcome is null/undefined (though it should be set if resolved)
        if (account.outcome === null) return false;

        return bet.account.direction === account.outcome;
    });

    return (
        <Card className="bg-custom-card border-custom-card border hover:border-primary/50 transition-colors backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="space-y-1">
                    <CardTitle className="text-base">{account.question}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-xs text-muted-foreground px-0 py-0.5 rounded">{account.assetSymbol}/USD</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${account.resolved ? "bg-gray-800 text-gray-400" : "bg-green-900 text-green-400"}`}>
                            {account.resolved ? (account.outcome ? "YES WON" : "NO WON") : "LIVE"}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between mb-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Start Price</p>
                        <p className="font-mono">${(account.startPrice.toNumber() / 1e8).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-muted-foreground">Time Left</p>
                        <p className={`font-mono font-bold ${isEnded ? 'text-red-500' : 'text-blue-400'}`}>
                            {isEnded ? "Ended" : formatTime(timeLeft)}
                        </p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    {/* Total Pool & Percentages */}
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Pool</p>
                            <p className="text-2xl font-bold tracking-tight text-white flex items-center gap-1">
                                <span className="text-primary text-sm">◎</span>
                                <span className="text-sm">{((account.totalUpPool.toNumber() + account.totalDownPool.toNumber()) / 1e9).toFixed(2)}</span>
                            </p>
                        </div>
                        <div className="text-right space-y-1 hidden">
                            {/* Optional: Add participant count if available in future */}
                        </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-3">
                        {/* YES Bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-outcome-yes">YES</span>
                                <span className="text-outcome-yes">{(account.totalUpPool.toNumber() / 1e9).toFixed(2)} SOL ({((account.totalUpPool.toNumber() / (account.totalUpPool.toNumber() + account.totalDownPool.toNumber() || 1)) * 100).toFixed(0)}%)</span>
                            </div>
                            <Progress
                                value={(account.totalUpPool.toNumber() / (account.totalUpPool.toNumber() + account.totalDownPool.toNumber() || 1)) * 100}
                                className="h-2 bg-secondary/50"
                                indicatorClassName="bg-outcome-yes"
                            />
                        </div>

                        {/* NO Bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-outcome-no">NO</span>
                                <span className="text-outcome-no">{(account.totalDownPool.toNumber() / 1e9).toFixed(2)} SOL ({((account.totalDownPool.toNumber() / (account.totalUpPool.toNumber() + account.totalDownPool.toNumber() || 1)) * 100).toFixed(0)}%)</span>
                            </div>
                            <Progress
                                value={(account.totalDownPool.toNumber() / (account.totalUpPool.toNumber() + account.totalDownPool.toNumber() || 1)) * 100}
                                className="h-2 bg-secondary/50"
                                indicatorClassName="bg-outcome-no"
                            />
                        </div>
                    </div>
                </div>

                {/* User Bets Status */}
                {userBets.length > 0 && (
                    <div className="mb-4 p-2 bg-secondary/20 rounded text-xs space-y-1">
                        <p className="font-semibold text-muted-foreground">Your Bets:</p>
                        {userBets.map(bet => (
                            <div key={bet.publicKey.toString()} className="flex justify-between items-center">
                                <span>{(bet.account.amount.toNumber() / 1e9).toFixed(2)} SOL on {bet.account.direction ? "YES" : "NO"}</span>
                                <span className={bet.account.claimed ? "text-green-500" : "text-yellow-500"}>
                                    {bet.account.claimed ? "Claimed" : "Unclaimed"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {!account.resolved && (
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">SOL</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full pl-8 pr-2 py-2 text-sm bg-secondary rounded border border-input"
                                disabled={isEnded}
                            />
                        </div>
                        <Button onClick={() => placeBet(true)} disabled={isEnded} className="flex-1 bg-outcome-yes hover:bg-outcome-yes/80 text-white h-10 font-bold shadow-[0_0_10px_rgba(53,125,119,0.3)]">
                            YES
                        </Button>
                        <Button onClick={() => placeBet(false)} disabled={isEnded} className="flex-1 bg-outcome-no hover:bg-outcome-no/80 text-white h-10 font-bold shadow-[0_0_10px_rgba(145,42,45,0.3)]">
                            NO
                        </Button>
                    </div>
                )}

                {/* Claim Button */}
                {account.resolved && winningBets.length > 0 && (
                    <div className="mt-4 pt-3 border-t space-y-2">
                        {(() => {
                            const bet = winningBets[0];
                            const totalPool = account.totalUpPool.toNumber() + account.totalDownPool.toNumber();
                            const winnerPool = account.outcome ? account.totalUpPool.toNumber() : account.totalDownPool.toNumber();
                            const userBetAmount = bet.account.amount.toNumber();

                            // Calculate Payout: (UserBet / WinnerPool) * (TotalPool * 0.98)
                            const fee = totalPool * 0.02;
                            const netPool = totalPool - fee;
                            const share = userBetAmount / winnerPool;
                            const payout = share * netPool;

                            return (
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground mb-1">
                                        You will get <span className="text-white font-bold">{(payout / 1e9).toFixed(4)} SOL</span>
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/70 mb-2">
                                        (Your Share: {(share * 100).toFixed(1)}% of Net Pool)
                                    </p>
                                    <Button
                                        className="w-full bg-outcome-yes hover:bg-outcome-yes/80 text-white font-bold animate-pulse shadow-[0_0_15px_rgba(53,125,119,0.5)]"
                                        onClick={() => claim(bet.publicKey)}
                                    >
                                        🎉 Claim Winnings
                                    </Button>
                                    {winningBets.length > 1 && <p className="text-xs text-center text-muted-foreground mt-1">Found {winningBets.length} winning bets. Claim one by one.</p>}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {!account.resolved && (
                    <div className="mt-4 pt-3 border-t">
                        <Button
                            variant={isEnded ? "default" : "ghost"}
                            size="sm"
                            onClick={resolve}
                            disabled={!isEnded}
                            className={`w-full text-xs ${isEnded ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'}`}
                        >
                            {isEnded ? "⚡ Resolve Market Now" : "Resolve (Wait for End)"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
