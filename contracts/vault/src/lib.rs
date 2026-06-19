#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Env, Address, token, symbol_short, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InsufficientBalance = 3,
    InvalidAmount = 4,
    Unauthorized = 5,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Token,
    Balance(Address),
    Milestone(Address),
}

#[contract]
pub struct FutureSelfVault;

#[contractimpl]
impl FutureSelfVault {
    pub fn initialize(env: Env, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Token) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Token, &token);
        Ok(())
    }

    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        let balance_key = DataKey::Balance(from.clone());
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        let new_balance = current_balance + amount;

        env.storage().persistent().set(&balance_key, &new_balance);

        // Emit event: deposit, from, amount, new_balance
        env.events().publish(
            (symbol_short!("deposit"), from),
            (amount, new_balance),
        );

        Ok(new_balance)
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<i128, Error> {
        to.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        let balance_key = DataKey::Balance(to.clone());
        let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);

        if current_balance < amount {
            return Err(Error::InsufficientBalance);
        }

        let new_balance = current_balance - amount;
        env.storage().persistent().set(&balance_key, &new_balance);

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        // Emit event: withdraw, to, amount, new_balance
        env.events().publish(
            (symbol_short!("withdraw"), to),
            (amount, new_balance),
        );

        Ok(new_balance)
    }

    pub fn set_milestone(env: Env, who: Address, target: i128) -> Result<i128, Error> {
        who.require_auth();
        if target < 0 {
            return Err(Error::InvalidAmount);
        }

        let milestone_key = DataKey::Milestone(who.clone());
        env.storage().persistent().set(&milestone_key, &target);

        // Emit event: milestone_set, who, target
        env.events().publish(
            (Symbol::new(&env, "milestone"), who),
            target,
        );

        Ok(target)
    }

    pub fn get_balance(env: Env, who: Address) -> i128 {
        let balance_key = DataKey::Balance(who);
        env.storage().persistent().get(&balance_key).unwrap_or(0)
    }

    pub fn get_milestone(env: Env, who: Address) -> i128 {
        let milestone_key = DataKey::Milestone(who);
        env.storage().persistent().get(&milestone_key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_vault_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, FutureSelfVault);
        let client = FutureSelfVaultClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let token_admin = env.register_stellar_asset_contract(admin.clone());
        let token_client = token::Client::new(&env, &token_admin);
        let token_admin_client = token::StellarAssetClient::new(&env, &token_admin);

        client.initialize(&token_admin);

        token_admin_client.mint(&user, &1000);
        assert_eq!(token_client.balance(&user), 1000);

        let new_bal = client.deposit(&user, &400);
        assert_eq!(new_bal, 400);
        assert_eq!(token_client.balance(&user), 600);
        assert_eq!(token_client.balance(&contract_id), 400);
        assert_eq!(client.get_balance(&user), 400);

        client.set_milestone(&user, &500);
        assert_eq!(client.get_milestone(&user), 500);

        let new_bal2 = client.withdraw(&user, &150);
        assert_eq!(new_bal2, 250);
        assert_eq!(token_client.balance(&user), 750);
        assert_eq!(token_client.balance(&contract_id), 250);
        assert_eq!(client.get_balance(&user), 250);
    }
}
