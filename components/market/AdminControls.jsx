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
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export default function AdminControls({ onMarketCreated }) {
    const { program } = useProgram();
    const wallet = useWallet();
    const { connection } = useConnection();
    const [question, setQuestion] = useState('Will BTC go above $90,000?');
    const [asset, setAsset] = useState('BTC');
    const [targetPrice, setTargetPrice] = useState('90000'); // Default target

    // Default end date to today (Start with current time)
    const getDefaultEndDate = () => {
        return new Date().toISOString();
    };

    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [loading, setLoading] = useState(false);

    const [currentAssetPrice, setCurrentAssetPrice] = useState(null);
    const [marketTrend, setMarketTrend] = useState('bullish'); // 'bullish' | 'bearish'

    // Auto-update target price when asset changes
    useEffect(() => {
        const updateTargetPrice = async () => {
            if (!asset) return;
            const feedId = PYTH_FEED_IDS[asset];
            if (!feedId) return;

            try {
                // Fetch current price
                const priceData = await getCurrentPrice(feedId);
                const currentPrice = priceData.price * Math.pow(10, priceData.expo);
                setCurrentAssetPrice(currentPrice);

                // Default to Bullish (+10%)
                const autoTarget = currentPrice * 1.10;
                setTargetPrice(autoTarget.toFixed(2));
                setMarketTrend('bullish');
            } catch (error) {
                console.error("Failed to fetch price for auto-target:", error);
            }
        };

        updateTargetPrice();
    }, [asset]);

    // Auto-detect trend when target price changes manually
    useEffect(() => {
        if (!currentAssetPrice || !targetPrice) return;
        const target = parseFloat(targetPrice);
        if (isNaN(target)) return;

        if (target > currentAssetPrice) {
            setMarketTrend('bullish');
        } else if (target < currentAssetPrice) {
            setMarketTrend('bearish');
        }
    }, [targetPrice, currentAssetPrice]);

    // Auto-update question when asset or target price changes
    useEffect(() => {
        const formattedPrice = Number(targetPrice).toLocaleString();
        const target = parseFloat(targetPrice);
        const direction = (!currentAssetPrice || target > currentAssetPrice) ? "go above" : "go below";
        setQuestion(`Will ${asset} ${direction} $${formattedPrice}?`);
    }, [asset, targetPrice, currentAssetPrice]);

    const setBullishStrategy = () => {
        if (!currentAssetPrice) return;
        const newTarget = currentAssetPrice * 1.10;
        setTargetPrice(newTarget.toFixed(2));
        setMarketTrend('bullish');
    };

    const setBearishStrategy = () => {
        if (!currentAssetPrice) return;
        const newTarget = currentAssetPrice * 0.90;
        setTargetPrice(newTarget.toFixed(2));
        setMarketTrend('bearish');
    };

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
            // Remove commas and parse as float, then convert to integer
            const targetPriceNum = Math.floor(parseFloat(targetPrice.replace(/,/g, '')));
            const targetPriceBn = new BN(targetPriceNum).mul(new BN(10).pow(new BN(8)));

            console.log('Using price update account:', priceUpdateAccount.toString());
            console.log('Initial Price:', initialPrice.toString());
            console.log('Target Price:', targetPriceBn.toString());

            const inverted = targetPriceBn.lt(initialPrice);
            console.log('Inverted Market:', inverted);

            await program.methods
                .initializeMarket(question, asset, new BN(durationSeconds), feedIdArray, initialPrice, priceConf, targetPriceBn, inverted)
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
                                {Object.keys(PYTH_FEED_IDS).map((key) => (
                                    <SelectItem key={key} value={key}>{key}/USD</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 flex flex-col pt-1">
                        <Label className="mb-2">Market End Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal hover:text-muted-foreground",
                                        !endDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(new Date(endDate), "PPP p") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={new Date(endDate)}
                                    disabled={(date) => date < new Date()}
                                    onSelect={(date) => {
                                        if (date) {
                                            const current = new Date(endDate);
                                            date.setHours(current.getHours());
                                            date.setMinutes(current.getMinutes());
                                            setEndDate(date.toISOString());
                                        }
                                    }}
                                    initialFocus
                                />
                                <div className="p-3 border-t border-border">
                                    <Label className="mb-2 block text-xs">Time</Label>
                                    <Input
                                        type="time"
                                        value={endDate ? format(new Date(endDate), "HH:mm") : "00:00"}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':');
                                            const newDate = new Date(endDate);
                                            newDate.setHours(parseInt(hours));
                                            newDate.setMinutes(parseInt(minutes));
                                            setEndDate(newDate.toISOString());
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Target Price (USD)
                        {currentAssetPrice && <span className="text-xs text-muted-foreground">Current: ${currentAssetPrice.toLocaleString()}</span>}
                    </Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                        <Input
                            placeholder="90000"
                            value={targetPrice}
                            onChange={(e) => setTargetPrice(e.target.value)}
                            className="pl-7" // padding-left for the dollar sign
                        />
                    </div>

                    <div className="flex gap-2 mt-1">
                        {(() => {
                            let percentDiff = 10.0;
                            if (currentAssetPrice && targetPrice && !isNaN(parseFloat(targetPrice))) {
                                const target = parseFloat(targetPrice);
                                percentDiff = ((target - currentAssetPrice) / currentAssetPrice) * 100;
                            }

                            return (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={setBullishStrategy}
                                        className={`flex-1 h-7 text-xs font-bold ${marketTrend === 'bullish' ? 'bg-outcome-yes/20 text-outcome-yes border-outcome-yes hover:bg-outcome-yes/30 hover:text-outcome-yes' : 'text-muted-foreground hover:text-muted-foreground'}`}
                                    >
                                        📈 BULLISH {marketTrend === 'bullish' ? `(+${Math.abs(percentDiff).toFixed(1)}%)` : '(+10%)'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={setBearishStrategy}
                                        className={`flex-1 h-7 text-xs font-bold ${marketTrend === 'bearish' ? 'bg-outcome-no/20 text-outcome-no border-outcome-no hover:bg-outcome-no/30 hover:text-outcome-no' : 'text-muted-foreground hover:text-muted-foreground'}`}
                                    >
                                        📉 BEARISH {marketTrend === 'bearish' ? `(-${Math.abs(percentDiff).toFixed(1)}%)` : '(-10%)'}
                                    </Button>
                                </>
                            )
                        })()}
                    </div>
                </div>

                <Button
                    onClick={createMarket}
                    disabled={loading || !wallet.publicKey}
                    className="w-full"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Market...
                        </>
                    ) : (
                        "Create Market"
                    )}
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
