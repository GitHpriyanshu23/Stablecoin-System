/*
 * Main driver for the Midnight stablecoin CLI.
 */

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  StablecoinAPI,
  type StablecoinDerivedState,
  stablecoinPrivateStateKey,
  type StablecoinProviders,
  type DeployedStablecoinContract,
  type PrivateStateId,
  CONTRACT_ADDRESS,
} from '../../api/src/index';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger, VaultState } from '../../contract/src/managed/stablecoin/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { randomBytes } from '../../api/src/utils';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils';
import { generateDust } from './generate-dust';
import { StablecoinPrivateState } from '../../contract/src/witnesses.js';

// @ts-expect-error: It's needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const getStablecoinLedgerState = async (
  providers: StablecoinProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new stablecoin contract
  2. Join an existing stablecoin contract
  3. Join configured contract address (${CONTRACT_ADDRESS})
  4. Exit
Which would you like to do? `;

const deployOrJoin = async (
  providers: StablecoinProviders,
  rli: Interface,
  logger: Logger,
): Promise<StablecoinAPI | null> => {
  let api: StablecoinAPI | null = null;

  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        api = await StablecoinAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      case '2':
        api = await StablecoinAPI.join(providers, await rli.question('What is the contract address (in hex)? '), logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      case '3': {
        if (CONTRACT_ADDRESS.includes('<')) {
          logger.error('Replace <YOUR_DEPLOYED_CONTRACT_ADDRESS> before joining the configured address.');
          break;
        }
        api = await StablecoinAPI.join(providers, CONTRACT_ADDRESS, logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      }
      case '4':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const displayLedgerState = async (
  providers: StablecoinProviders,
  deployedContract: DeployedStablecoinContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedContract.deployTxData.public.contractAddress;
  const ledgerState = await getStablecoinLedgerState(providers, contractAddress);
  if (ledgerState === null) {
    logger.info(`There is no stablecoin contract deployed at ${contractAddress}`);
  } else {
    logger.info(`Vault state: '${ledgerState.vaultState === VaultState.OPEN ? 'open' : 'closed'}'`);
    logger.info(`Total supply: ${ledgerState.totalSupply}`);
    logger.info(`Total collateral: ${ledgerState.totalCollateral}`);
    logger.info(`Vault collateral: ${ledgerState.vaultCollateral}`);
    logger.info(`Vault debt: ${ledgerState.vaultDebt}`);
    logger.info(`Min collateral ratio (bps): ${ledgerState.minCollateralRatioBps}`);
    logger.info(`Sequence: ${ledgerState.sequence}`);
    logger.info(`Owner commitment: '${toHex(ledgerState.owner)}'`);
  }
};

const displayPrivateState = async (providers: StablecoinProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(stablecoinPrivateStateKey);
  if (privateState === null) {
    logger.info(`There is no existing stablecoin private state`);
  } else {
    logger.info(`Current secret key is: ${toHex(privateState.secretKey)}`);
    logger.info(`Pending collateral units: ${privateState.collateralUnits}`);
    logger.info(`Pending stable units: ${privateState.stableUnits}`);
  }
};

const displayDerivedState = (ledgerState: StablecoinDerivedState | undefined, logger: Logger) => {
  if (ledgerState === undefined) {
    logger.info(`No stablecoin state currently available`);
  } else {
    logger.info(`Vault state: '${ledgerState.vaultState === VaultState.OPEN ? 'open' : 'closed'}'`);
    logger.info(`Total supply: ${ledgerState.totalSupply}`);
    logger.info(`Total collateral: ${ledgerState.totalCollateral}`);
    logger.info(`Vault collateral: ${ledgerState.vaultCollateral}`);
    logger.info(`Vault debt: ${ledgerState.vaultDebt}`);
    logger.info(`Current owner is: '${ledgerState.isOwner ? 'you' : 'not you'}'`);
  }
};

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Open vault (collateral + mint)
  2. Add collateral
  3. Mint stablecoins
  4. Close vault
  5. Display the current ledger state (known by everyone)
  6. Display the current private state (known only to this DApp instance)
  7. Display the current derived state (known only to this DApp instance)
  8. Exit
Which would you like to do? `;

const mainLoop = async (providers: StablecoinProviders, rli: Interface, logger: Logger): Promise<void> => {
  const api = await deployOrJoin(providers, rli, logger);
  if (api === null) {
    return;
  }
  let currentState: StablecoinDerivedState | undefined;
  const stateObserver = {
    next: (state: StablecoinDerivedState) => (currentState = state),
  };
  const subscription = api.state$.subscribe(stateObserver);
  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1': {
            const collateral = Number(await rli.question('Collateral units to lock? '));
            const mint = Number(await rli.question('Stablecoin units to mint? '));
            await api.openVault(collateral, mint);
            break;
          }
          case '2': {
            const collateral = Number(await rli.question('Collateral units to add? '));
            await api.addCollateral(collateral);
            break;
          }
          case '3': {
            const mint = Number(await rli.question('Stablecoin units to mint? '));
            await api.mintStable(mint);
            break;
          }
          case '4':
            await api.closeVault();
            break;
          case '5':
            await displayLedgerState(providers, api.deployedContract, logger);
            break;
          case '6':
            await displayPrivateState(providers, logger);
            break;
          case '7':
            displayDerivedState(currentState, logger);
            break;
          case '8':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
        logger.info('Returning to main menu...');
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation registration transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<
      'openVault' | 'addCollateral' | 'mintStable' | 'closeVault'
    >(config.zkConfigPath);
    const providers: StablecoinProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, StablecoinPrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => {
          return 'Stablecoin-Test-2026!';
        },
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider: walletProvider,
      midnightProvider: walletProvider,
    };
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
