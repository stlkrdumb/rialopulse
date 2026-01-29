import { useEffect, useState } from 'react';
import { PYTH_FEED_IDS, getCurrentPrice, formatPrice } from '@/utils/pyth';

export default function PriceTicker() {
    const [prices, setPrices] = useState({
        BTC: { price: null, loading: true, error: null },
        ETH: { price: null, loading: true, error: null },
        SOL: { price: null, loading: true, error: null },
    });

    const fetchPrice = async (asset) => {
        try {
            const feedId = PYTH_FEED_IDS[asset];
            const priceData = await getCurrentPrice(feedId);

            setPrices(prev => ({
                ...prev,
                [asset]: {
                    price: priceData,
                    loading: false,
                    error: null,
                }
            }));
        } catch (error) {
            console.error(`Error fetching ${asset} price:`, error);
            setPrices(prev => ({
                ...prev,
                [asset]: {
                    price: null,
                    loading: false,
                    error: error.message,
                }
            }));
        }
    };

    useEffect(() => {
        // Fetch initial prices
        fetchPrice('BTC');
        fetchPrice('ETH');
        fetchPrice('SOL');

        // Update every 10 seconds
        const interval = setInterval(() => {
            fetchPrice('BTC');
            fetchPrice('ETH');
            fetchPrice('SOL');
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const renderPrice = (asset, data) => {
        if (data.loading) {
            return <span className="text-gray-400">Loading...</span>;
        }

        if (data.error) {
            return <span className="text-red-400 text-xs">Error</span>;
        }

        if (!data.price) {
            return <span className="text-gray-400">--</span>;
        }

        const formattedPrice = formatPrice(data.price.price, data.price.expo);

        return (
            <span className="font-mono font-semibold">
                ${formattedPrice}
            </span>
        );
    };

    return (
        <div className="bg-gradient-to-r from-amber-900/30 via-emerald-900/30 to-green-900/30 border-b border-gray-800">
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-orange-400 font-bold">₿ BTC:</span>
                        {renderPrice('BTC', prices.BTC)}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">Ξ ETH:</span>
                        {renderPrice('ETH', prices.ETH)}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-bold">◎ SOL:</span>
                        {renderPrice('SOL', prices.SOL)}
                    </div>
                </div>
            </div>
        </div>
    );
}
