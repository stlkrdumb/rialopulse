use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

declare_id!("6kdWRDeTupf2DK3A8p1JRjh6adpFStzLZjBany25GY97");

#[program]
pub mod solana_prediction_market {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        question: String,
        asset: String,
        duration: i64,
        feed_id: [u8; 32],
        initial_price: i64,
        price_conf: u64,
        target_price: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        // Use the passed-in price (verified by frontend against Pyth)
        // In a mainnet production version, we would verify this on-chain
        // by deserializing the Pyth V2 account directly.
        // For now, this allows us to use real-time prices on Devnet with V1/V2 compatibility.

        market.admin = ctx.accounts.user.key();
        market.question = question;
        market.asset_symbol = asset;
        market.feed_id = feed_id;
        
        market.start_price = initial_price;
        market.price_conf = price_conf;
        market.target_price = target_price;
        
        market.start_time = clock.unix_timestamp;
        market.end_time = clock.unix_timestamp + duration;
        
        market.total_up_pool = 0;
        market.total_down_pool = 0;
        market.resolved = false;
        market.outcome = None;
        market.vault_bump = ctx.bumps.vault;
        
        msg!("Market initialized for {}. Start Price: {} (±{})", market.asset_symbol, market.start_price, market.price_conf);
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>, direction: bool, amount: u64) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let market = &mut ctx.accounts.market;
        let user = &mut ctx.accounts.user;
        let vault = &mut ctx.accounts.vault;
        let system_program = &ctx.accounts.system_program;

        // Verify market window
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < market.end_time, ErrorCode::MarketClosed);

        // Transfer SOL from user to vault
        let cpi_context = CpiContext::new(
            system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: user.to_account_info(),
                to: vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        
        bet.user = user.key();
        bet.market = market.key();
        bet.amount = amount;
        bet.direction = direction;
        bet.claimed = false;

        if direction {
            market.total_up_pool += amount;
        } else {
            market.total_down_pool += amount;
        }

        msg!("Bet placed: {} lamports on {}", amount, if direction { "Up" } else { "Down" });
        Ok(())
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, final_price: i64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;

        // Ensure market ended
        require!(clock.unix_timestamp >= market.end_time, ErrorCode::MarketNotEnded);
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);

        // Use passed-in final price (verified by frontend against Pyth)
        // In production, we would deserialize Pyth account on-chain
        let end_price = final_price;
        
        // Outcome logic: YES if End Price >= Target Price
        let outcome = end_price >= market.target_price;
        
        market.outcome = Some(outcome);
        market.resolved = true;
        market.end_price = end_price;
        
        msg!("Market resolved. Target: {}, End: {}. Outcome: {}", market.target_price, end_price, if outcome { "YES" } else { "NO" });
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let market = &mut ctx.accounts.market;
        let user = &mut ctx.accounts.user;
        let vault = &mut ctx.accounts.vault;
        
        require!(market.resolved, ErrorCode::MarketNotResolved);
        require!(!bet.claimed, ErrorCode::AlreadyClaimed);
        
        // Check if user won
        let outcome = market.outcome.unwrap();
        require!(bet.direction == outcome, ErrorCode::LostBet);
        
        // Calculate payout
        let total_pool = market.total_up_pool + market.total_down_pool;
        let winner_pool = if outcome { market.total_up_pool } else { market.total_down_pool };
        
        require!(winner_pool > 0, ErrorCode::MathError);
        
        // Fee Structure: 2% platform fee
        let fee_basis_points = 200u64;
        let total_pool_after_fee = (total_pool as u128)
            .checked_mul((10000 - fee_basis_points) as u128).unwrap()
            .checked_div(10000).unwrap();
            
        // Calculate user share
        let payout = (bet.amount as u128)
            .checked_mul(total_pool_after_fee).unwrap()
            .checked_div(winner_pool as u128).unwrap()
            as u64;
            
        // Transfer from vault to user
        **vault.to_account_info().try_borrow_mut_lamports()? -= payout;
        **user.to_account_info().try_borrow_mut_lamports()? += payout;
        
        bet.claimed = true;
        
        msg!("Claimed {} lamports (Fee: 2%)", payout);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(question: String, asset: String, duration: i64, feed_id: [u8; 32], initial_price: i64, price_conf: u64, target_price: i64)] 
pub struct InitializeMarket<'info> {
    #[account(init, payer = user, space = 8 + 32 + (4 + 200) + (4 + 10) + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 2 + 1 + 50)]
    pub market: Account<'info, Market>,
    
    /// Pyth price update account (owned by Pyth program)
    /// CHECK: This account is owned by the Pyth program
    pub price_update: UncheckedAccount<'info>,
    
    #[account(
        init,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    /// CHECK: Vault PDA
    pub vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(init, payer = user, space = 8 + 32 + 32 + 8 + 1 + 1)] 
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    /// CHECK: Vault PDA
    pub vault: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    
    /// Pyth price update account (owned by Pyth program)
    /// CHECK: This account is owned by the Pyth program
    pub price_update: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = user, has_one = market)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    /// CHECK: Vault PDA
    pub vault: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Market {
    pub admin: Pubkey,
    pub question: String,      // Market question (e.g., "Will BTC go above $90,000?")
    pub asset_symbol: String,
    pub feed_id: [u8; 32],     // Pyth feed ID
    pub target_price: i64,     // Target Price (e.g., $160,000)
    pub start_price: i64,
    pub end_price: i64,
    pub price_conf: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_up_pool: u64,
    pub total_down_pool: u64,
    pub resolved: bool,
    pub outcome: Option<bool>,
    pub vault_bump: u8,
}

#[account]
pub struct Bet {
    pub user: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub direction: bool,
    pub claimed: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market betting window is closed")]
    MarketClosed,
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    #[msg("Market already resolved")]
    MarketAlreadyResolved,
    #[msg("Market not resolved yet")]
    MarketNotResolved,
    #[msg("Bet already claimed")]
    AlreadyClaimed,
    #[msg("User did not win")]
    LostBet,
    #[msg("Math error")]
    MathError,
}
