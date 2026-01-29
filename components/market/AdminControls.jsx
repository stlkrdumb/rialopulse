import { useState, useEffect } from 'react';
import { useProgram, PROGRAM_ID } from '@/hooks/useProgram';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN, web3 } from '@coral-xyz/anchor';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PYTH_FEED_IDS, hexToFeedId, getOrCreatePriceUpdateAccount, getCurrentPrice } from '@/utils/pyth';

export default function AdminControls({ onMarketCreated }) {
    const { program } = useProgram();
    const wallet = useWallet();
    const { connection } = useConnection();
    const [question, setQuestion] = useState('Will BTC go above $90,000?');
    const [asset, setAsset] = useState('BTC');
    const [targetPrice, setTargetPrice] = useState('90000'); // Default target

    // Default end date to 24 hours from now
    const getDefaultEndDate = () => {
        const date = new Date();
        date.setHours(date.getHours() + 24);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); // Local time adjustment
        return date.toISOString().slice(0, 16);
    };

    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [loading, setLoading] = useState(false);

    // Auto-update question when asset or target price changes
    useEffect(() => {
        const formattedPrice = Number(targetPrice).toLocaleString();
        setQuestion(`Will ${asset} go above $${formattedPrice}?`);
    }, [asset, targetPrice]);

    const createMarket = async () => {
        if (!wallet.publicKey || !program) {
            toast.error("Connect wallet first!");
            return;
        }

        if (!question.trim()) {
            toast.error("Please enter a market question!");
            return;
        }

        // Calculate duration from endDate
        const endTimestamp = new Date(endDate).getTime();
        const now = Date.now();
        const durationSeconds = Math.floor((endTimestamp - now) / 1000);

        if (durationSeconds < 60) {
            toast.error("Market end time must be at least 1 minute in the future!");
            return;
        }

        setLoading(true);
        try {
            const marketKeypair = web3.Keypair.generate();

            // Get Pyth feed ID for selected asset
            const feedIdHex = PYTH_FEED_IDS[asset];
            if (!feedIdHex) {
                throw new Error(`No Pyth feed ID found for ${asset}`);
            }

            const feedIdArray = hexToFeedId(feedIdHex);

            // Derive vault PDA
            const [vaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), marketKeypair.publicKey.toBuffer()],
                PROGRAM_ID
            );

            // Get or create real Pyth price update account
            console.log('Fetching Pyth price update for', asset, '...');

            // 1. Get the price update account (for validation)
            const priceUpdateAccount = await getOrCreatePriceUpdateAccount(
                connection,
                wallet,
                feedIdHex
            );

            // 2. Get the current price value (to pass as initial price)
            console.log('Fetching current price value...');
            const priceData = await getCurrentPrice(feedIdHex);

            // Convert price to on-chain format (price * 10^expo)
            // Note: Pyth prices have expo like -8, so we need to adjust
            const initialPrice = new BN(priceData.price);
            const priceConf = new BN(priceData.conf);

            // 3. Prepare Target Price (ensure 8 decimals)
            // User input 90000 -> 90000 * 10^8
            const targetPriceBn = new BN(targetPrice).mul(new BN(10).pow(new BN(8)));

            console.log('Using price update account:', priceUpdateAccount.toString());
            console.log('Initial Price:', initialPrice.toString());
            console.log('Target Price:', targetPriceBn.toString());

            await program.methods
                .initializeMarket(question, asset, new BN(durationSeconds), feedIdArray, initialPrice, priceConf, targetPriceBn)
                .accounts({
                    market: marketKeypair.publicKey,
                    priceUpdate: priceUpdateAccount,
                    vault: vaultPda,
                    user: wallet.publicKey,
                    systemProgram: web3.SystemProgram.programId,
                })
                .signers([marketKeypair])
                .rpc();

            console.log("Market Created:", marketKeypair.publicKey.toString());
            console.log("Question:", question);
            console.log("Feed ID:", feedIdHex);

            toast.success(`Market created! Question: ${question}`, {
                description: `Market ID: ${marketKeypair.publicKey.toString()}`
            });

            // Reset form
            setQuestion('Will BTC go above $90,000?');
            setEndDate(getDefaultEndDate());

            if (onMarketCreated) onMarketCreated();

        } catch (e) {
            console.error("Error creating market:", e);
            toast.error("Failed to create market", {
                description: e.message || e.toString()
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="mb-6 border-custom-card bg-custom-card backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Create YES/NO Market</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Market Question</Label>
                    <Input
                        placeholder="e.g., Will BTC go above $90,000 by end of day?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Price Feed</Label>
                        <Select value={asset} onValueChange={setAsset}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Asset" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BTC">BTC/USD</SelectItem>
                                <SelectItem value="ETH">ETH/USD</SelectItem>
                                <SelectItem value="SOL">SOL/USD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Target Price (USD)</Label>
                        <Input
                            placeholder="e.g., 90000"
                            value={targetPrice}
                            onChange={(e) => setTargetPrice(e.target.value)}
                        />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <Label>Market End Date (Local Time)</Label>
                        <Input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <Button
                    onClick={createMarket}
                    disabled={loading || !wallet.publicKey}
                    className="w-full"
                >
                    {loading ? "Creating Market..." : "Create Market"}
                </Button>

                <div className="text-sm text-muted-foreground space-y-1">
                    <p>💡 Markets use real-time Pyth Network price feeds</p>
                    <p>🎯 Users bet YES (price goes up) or NO (price goes down)</p>
                    <p>⏱️ Market Ends: {new Date(endDate).toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
    );
}
