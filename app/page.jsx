'use client';

import { useState } from 'react';
import Header from '@/components/header';
import LiveMarketList from '@/components/market/LiveMarketList';
import AdminControls from '@/components/market/AdminControls';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Icons imported in child components



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
            <LiveMarketList />
          </TabsContent>

          <TabsContent value="create">
            <div className="max-w-xl mx-auto">
              <AdminControls onMarketCreated={() => window.location.reload()} />
              {/* Simple reload to refresh for now, ideally use context or swr */}
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
