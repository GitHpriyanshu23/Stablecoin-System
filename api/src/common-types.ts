/**
 * Stablecoin common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { VaultState, StablecoinPrivateState, Contract, Witnesses } from '../../contract/src/index';

export const stablecoinPrivateStateKey = 'stablecoinPrivateState';
export type PrivateStateId = typeof stablecoinPrivateStateKey;

/**
 * Contract address placeholder used until the Compact contract is deployed manually.
 * Replace every occurrence of this value after deployment.
 */
export const CONTRACT_ADDRESS = '<YOUR_DEPLOYED_CONTRACT_ADDRESS>';

/**
 * The private states consumed throughout the application.
 *
 * @public
 */
export type PrivateStates = {
  /**
   * Key used to provide the private state for {@link StablecoinContract} deployments.
   */
  readonly stablecoinPrivateState: StablecoinPrivateState;
};

/**
 * Represents a stablecoin contract and its private state.
 *
 * @public
 */
export type StablecoinContract = Contract<StablecoinPrivateState, Witnesses<StablecoinPrivateState>>;

/**
 * The keys of the circuits exported from {@link StablecoinContract}.
 *
 * @public
 */
export type StablecoinCircuitKeys = Exclude<keyof StablecoinContract['impureCircuits'], number | symbol>;

/**
 * The providers required by {@link StablecoinContract}.
 *
 * @public
 */
export type StablecoinProviders = MidnightProviders<StablecoinCircuitKeys, PrivateStateId, StablecoinPrivateState>;

/**
 * A {@link StablecoinContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedStablecoinContract = FoundContract<StablecoinContract>;

/**
 * Derived combination of public (ledger) and private state.
 */
export type StablecoinDerivedState = {
  readonly vaultState: VaultState;
  readonly totalSupply: bigint;
  readonly totalCollateral: bigint;
  readonly vaultCollateral: bigint;
  readonly vaultDebt: bigint;
  readonly minCollateralRatioBps: bigint;
  readonly sequence: bigint;

  /**
   * True when the current private secret key corresponds to the vault owner commitment.
   */
  readonly isOwner: boolean;
};
