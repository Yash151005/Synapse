#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String};

#[contract]
pub struct DisputeContract;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Resolution {
    Release,
    Refund,
    Split,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Dispute {
    pub id: u64,
    pub escrow_id: u64,
    pub opener: Address,
    pub reviewer: Address,
    pub amount: i128,
    pub evidence_hash: BytesN<32>,
    pub status: DisputeStatus,
    pub resolution: Option<Resolution>,
    pub note: String,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Dispute(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    NotOpen = 2,
    InvalidAmount = 3,
}

#[contractimpl]
impl DisputeContract {
    pub fn open(
        env: Env,
        escrow_id: u64,
        opener: Address,
        reviewer: Address,
        amount: i128,
        evidence_hash: BytesN<32>,
        note: String,
    ) -> Result<u64, Error> {
        opener.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let id = Self::next_id(&env);
        let dispute = Dispute {
            id,
            escrow_id,
            opener,
            reviewer,
            amount,
            evidence_hash,
            status: DisputeStatus::Open,
            resolution: None,
            note,
        };
        env.storage().persistent().set(&DataKey::Dispute(id), &dispute);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        Ok(id)
    }

    pub fn resolve(env: Env, id: u64, resolution: Resolution, note: String) -> Result<Dispute, Error> {
        let mut dispute = Self::get(env.clone(), id)?;
        dispute.reviewer.require_auth();
        if dispute.status != DisputeStatus::Open {
            return Err(Error::NotOpen);
        }
        dispute.status = DisputeStatus::Resolved;
        dispute.resolution = Some(resolution);
        dispute.note = note;
        env.storage().persistent().set(&DataKey::Dispute(id), &dispute);
        Ok(dispute)
    }

    pub fn get(env: Env, id: u64) -> Result<Dispute, Error> {
        env.storage().persistent().get(&DataKey::Dispute(id)).ok_or(Error::NotFound)
    }

    fn next_id(env: &Env) -> u64 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(1_u64)
    }
}
