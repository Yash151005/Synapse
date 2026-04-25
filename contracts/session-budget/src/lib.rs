#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String};

#[contract]
pub struct SessionBudget;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BudgetStatus {
    Open,
    Closed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Budget {
    pub session_hash: BytesN<32>,
    pub payer: Address,
    pub reviewer: Address,
    pub cap: i128,
    pub allocated: i128,
    pub expires_ledger: u32,
    pub status: BudgetStatus,
    pub policy: String,
}

#[contracttype]
pub enum DataKey {
    Budget(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    AlreadyExists = 2,
    Closed = 3,
    OverCap = 4,
    Expired = 5,
    InvalidAmount = 6,
}

#[contractimpl]
impl SessionBudget {
    pub fn open(
        env: Env,
        session_hash: BytesN<32>,
        payer: Address,
        reviewer: Address,
        cap: i128,
        expires_ledger: u32,
        policy: String,
    ) -> Result<Budget, Error> {
        payer.require_auth();
        if cap <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Budget(session_hash.clone())) {
            return Err(Error::AlreadyExists);
        }
        let budget = Budget {
            session_hash: session_hash.clone(),
            payer,
            reviewer,
            cap,
            allocated: 0,
            expires_ledger,
            status: BudgetStatus::Open,
            policy,
        };
        env.storage().persistent().set(&DataKey::Budget(session_hash), &budget);
        Ok(budget)
    }

    pub fn allocate(env: Env, session_hash: BytesN<32>, amount: i128) -> Result<Budget, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut budget = Self::get(env.clone(), session_hash.clone())?;
        budget.reviewer.require_auth();
        if budget.status != BudgetStatus::Open {
            return Err(Error::Closed);
        }
        if env.ledger().sequence() > budget.expires_ledger {
            return Err(Error::Expired);
        }
        if budget.allocated + amount > budget.cap {
            return Err(Error::OverCap);
        }
        budget.allocated += amount;
        env.storage().persistent().set(&DataKey::Budget(session_hash), &budget);
        Ok(budget)
    }

    pub fn close(env: Env, session_hash: BytesN<32>) -> Result<Budget, Error> {
        let mut budget = Self::get(env.clone(), session_hash.clone())?;
        budget.reviewer.require_auth();
        budget.status = BudgetStatus::Closed;
        env.storage().persistent().set(&DataKey::Budget(session_hash), &budget);
        Ok(budget)
    }

    pub fn get(env: Env, session_hash: BytesN<32>) -> Result<Budget, Error> {
        env.storage().persistent().get(&DataKey::Budget(session_hash)).ok_or(Error::NotFound)
    }
}
