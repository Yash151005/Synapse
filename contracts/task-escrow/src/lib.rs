#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, BytesN, Env, String};

#[contract]
pub struct TaskEscrow;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Locked,
    Released,
    Held,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub id: u64,
    pub payer: Address,
    pub payee: Address,
    pub reviewer: Address,
    pub token: Address,
    pub amount: i128,
    pub request_hash: BytesN<32>,
    pub response_hash: Option<BytesN<32>>,
    pub timeout_ledger: u32,
    pub status: EscrowStatus,
    pub reason: String,
}

#[contracttype]
pub enum DataKey {
    Admin,
    NextId,
    Escrow(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    NotLocked = 2,
    TimeoutNotReached = 3,
    InvalidAmount = 4,
}

#[contractimpl]
impl TaskEscrow {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &1_u64);
    }

    pub fn lock(
        env: Env,
        payer: Address,
        payee: Address,
        reviewer: Address,
        token: Address,
        amount: i128,
        request_hash: BytesN<32>,
        timeout_ledger: u32,
    ) -> Result<u64, Error> {
        payer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let id = Self::next_id(&env);
        token::Client::new(&env, &token).transfer(&payer, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            id,
            payer,
            payee,
            reviewer,
            token,
            amount,
            request_hash,
            response_hash: None,
            timeout_ledger,
            status: EscrowStatus::Locked,
            reason: String::from_str(&env, "locked"),
        };

        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        Ok(id)
    }

    pub fn release(env: Env, id: u64, response_hash: BytesN<32>) -> Result<Escrow, Error> {
        let mut escrow = Self::get_locked(&env, id)?;
        escrow.reviewer.require_auth();
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.payee,
            &escrow.amount,
        );
        escrow.status = EscrowStatus::Released;
        escrow.response_hash = Some(response_hash);
        escrow.reason = String::from_str(&env, "hash_match_success");
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        Ok(escrow)
    }

    pub fn hold(env: Env, id: u64, response_hash: BytesN<32>, reason: String) -> Result<Escrow, Error> {
        let mut escrow = Self::get_locked(&env, id)?;
        escrow.reviewer.require_auth();
        escrow.status = EscrowStatus::Held;
        escrow.response_hash = Some(response_hash);
        escrow.reason = reason;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        Ok(escrow)
    }

    pub fn refund(env: Env, id: u64, reason: String) -> Result<Escrow, Error> {
        let mut escrow: Escrow = env.storage().persistent().get(&DataKey::Escrow(id)).ok_or(Error::NotFound)?;
        if escrow.status != EscrowStatus::Locked && escrow.status != EscrowStatus::Held {
            return Err(Error::NotLocked);
        }
        if escrow.status == EscrowStatus::Locked && env.ledger().sequence() < escrow.timeout_ledger {
            escrow.reviewer.require_auth();
        }

        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.payer,
            &escrow.amount,
        );
        escrow.status = EscrowStatus::Refunded;
        escrow.reason = reason;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        Ok(escrow)
    }

    pub fn get(env: Env, id: u64) -> Result<Escrow, Error> {
        env.storage().persistent().get(&DataKey::Escrow(id)).ok_or(Error::NotFound)
    }

    fn get_locked(env: &Env, id: u64) -> Result<Escrow, Error> {
        let escrow: Escrow = env.storage().persistent().get(&DataKey::Escrow(id)).ok_or(Error::NotFound)?;
        if escrow.status != EscrowStatus::Locked {
            return Err(Error::NotLocked);
        }
        Ok(escrow)
    }

    fn next_id(env: &Env) -> u64 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(1_u64)
    }
}
