'use client';

import { useState } from 'react';
import Header from '@/components/header';
import MarketCard from '@/components/market-card';
import CreateMarket from '@/components/create-market';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Icons imported in child components

// Sample market data
const sampleMarkets = [
  {
    id: 1,
    title: "Will Bitcoin reach $100,000 by end of 2026?",
    description: "Market resolves YES if BTC/USD reaches $100k on any major exchange before Dec 31, 2026",
    endDate: "Dec 31, 2026",
    options: [
      { name: "Yes", volume: 45.5, participants: 234, trend: "up" },
      { name: "No", volume: 32.8, participants: 187, trend: "down" }
    ]
  },
  {
    id: 2,
    title: "Will Solana surpass Ethereum in TVL by 2027?",
    description: "Market resolves YES if Solana's Total Value Locked exceeds Ethereum's TVL",
    endDate: "Dec 31, 2027",
    options: [
      { name: "Yes", volume: 28.3, participants: 156, trend: "up" },
      { name: "No", volume: 51.2, participants: 298, trend: "down" }
    ]
  },
  {
    id: 3,
    title: "Will there be a new crypto in top 10 by market cap in 2026?",
    description: "Market resolves YES if a cryptocurrency not currently in top 10 enters top 10 by Dec 31, 2026",
    endDate: "Dec 31, 2026",
    options: [
      { name: "Yes", volume: 38.7, participants: 201, trend: "up" },
      { name: "No", volume: 29.4, participants: 165, trend: "down" }
    ]
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('markets');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="markets">Browse Markets</TabsTrigger>
            <TabsTrigger value="create">Create Market</TabsTrigger>
          </TabsList>

          <TabsContent value="markets" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sampleMarkets.map(market => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="create">
            <div className="max-w-2xl mx-auto">
              <CreateMarket />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built on Solana • Powered by decentralized prediction markets</p>
        </div>
      </footer>
    </div>
  );
}
