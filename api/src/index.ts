/**
 * Provides types and utilities for working with stablecoin contracts.
 *
 * @packageDocumentation
 */

import * as Stablecoin from '../../contract/src/managed/stablecoin/contract/index.js';

import { type ContractAddress, convertFieldToBytes } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type StablecoinDerivedState,
  type StablecoinContract,
  type StablecoinProviders,
  type DeployedStablecoinContract,
  stablecoinPrivateStateKey,
} from './common-types.js';
import { CompiledStablecoinContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { StablecoinPrivateState, createStablecoinPrivateState } from '../../contract/src/witnesses.js';

/**
 * An API for a deployed stablecoin system.
 */
export interface DeployedStablecoinAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<StablecoinDerivedState>;

  openVault: (collateralUnits: number, mintUnits: number) => Promise<void>;
  addCollateral: (collateralUnits: number) => Promise<void>;
  mintStable: (mintUnits: number) => Promise<void>;
  closeVault: () => Promise<void>;
}

/**
 * Provides an implementation of {@link DeployedStablecoinAPI} by adapting a deployed stablecoin contract.
 */
export class StablecoinAPI implements DeployedStablecoinAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedStablecoinContract,
    private readonly providers: StablecoinProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => Stablecoin.ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  vaultState: ledgerState.vaultState === Stablecoin.VaultState.OPEN ? 'open' : 'closed',
                  owner: toHex(ledgerState.owner),
                },
              },
            }),
          ),
        ),
        from(providers.privateStateProvider.get(stablecoinPrivateStateKey) as Promise<StablecoinPrivateState>),
      ],
      (ledgerState, privateState) => {
        const hashedSecretKey = Stablecoin.pureCircuits.publicKey(
          privateState.secretKey,
          convertFieldToBytes(32, ledgerState.sequence, 'api/src/index.ts'),
        );

        return {
          vaultState: ledgerState.vaultState,
          totalSupply: ledgerState.totalSupply,
          totalCollateral: ledgerState.totalCollateral,
          vaultCollateral: ledgerState.vaultCollateral,
          vaultDebt: ledgerState.vaultDebt,
          minCollateralRatioBps: ledgerState.minCollateralRatioBps,
          sequence: ledgerState.sequence,
          isOwner: toHex(ledgerState.owner) === toHex(hashedSecretKey),
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;

  readonly state$: Observable<StablecoinDerivedState>;

  async openVault(collateralUnits: number, mintUnits: number): Promise<void> {
    this.logger?.info(`openVault collateral=${collateralUnits} mint=${mintUnits}`);
    await this.setOperationAmounts(BigInt(collateralUnits), BigInt(mintUnits));
    const txData = await this.deployedContract.callTx.openVault();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'openVault',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async addCollateral(collateralUnits: number): Promise<void> {
    this.logger?.info(`addCollateral amount=${collateralUnits}`);
    await this.setOperationAmounts(BigInt(collateralUnits), 0n);
    const txData = await this.deployedContract.callTx.addCollateral();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'addCollateral',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async mintStable(mintUnits: number): Promise<void> {
    this.logger?.info(`mintStable amount=${mintUnits}`);
    await this.setOperationAmounts(0n, BigInt(mintUnits));
    const txData = await this.deployedContract.callTx.mintStable();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'mintStable',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  async closeVault(): Promise<void> {
    this.logger?.info('closeVault');
    const privateState = await this.providers.privateStateProvider.get(stablecoinPrivateStateKey);
    if (!privateState) {
      throw new Error('Missing stablecoin private state');
    }

    // Read current vault balances from the latest derived state via a one-shot ledger query path:
    // closeVault witnesses must disclose the full debt and collateral.
    const contractState = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (!contractState) {
      throw new Error('Unable to query contract state for closeVault');
    }
    const ledgerState = Stablecoin.ledger(contractState.data);
    await this.setOperationAmounts(ledgerState.vaultCollateral, ledgerState.vaultDebt);

    const txData = await this.deployedContract.callTx.closeVault();
    this.logger?.trace({
      transactionAdded: {
        circuit: 'closeVault',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  static async deploy(providers: StablecoinProviders, logger?: Logger): Promise<StablecoinAPI> {
    logger?.info('deployContract');

    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledStablecoinContractContract,
      privateStateId: stablecoinPrivateStateKey,
      initialPrivateState: createStablecoinPrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new StablecoinAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: StablecoinProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<StablecoinAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedContract = await findDeployedContract<StablecoinContract>(providers, {
      contractAddress,
      compiledContract: CompiledStablecoinContractContract,
      privateStateId: stablecoinPrivateStateKey,
      initialPrivateState: await StablecoinAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new StablecoinAPI(deployedContract, providers, logger);
  }

  private async setOperationAmounts(collateralUnits: bigint, stableUnits: bigint): Promise<void> {
    this.providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    const existing = await this.providers.privateStateProvider.get(stablecoinPrivateStateKey);
    if (!existing) {
      throw new Error('Missing stablecoin private state');
    }
    await this.providers.privateStateProvider.set(stablecoinPrivateStateKey, {
      secretKey: existing.secretKey,
      collateralUnits,
      stableUnits,
    });
  }

  private static async getPrivateState(
    providers: StablecoinProviders,
    contractAddress: ContractAddress,
  ): Promise<StablecoinPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(stablecoinPrivateStateKey);
    return existingPrivateState ?? createStablecoinPrivateState(utils.randomBytes(32));
  }
}

/**
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';
