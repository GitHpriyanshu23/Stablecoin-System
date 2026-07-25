import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  convertFieldToBytes,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/stablecoin/contract/index.js";
import { type StablecoinPrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the stablecoin contract in tests.
 */
export class StablecoinSimulator {
  readonly contract: Contract<StablecoinPrivateState>;
  circuitContext: CircuitContext<StablecoinPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<StablecoinPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(
        { secretKey, collateralUnits: 0n, stableUnits: 0n },
        "0".repeat(64),
      ),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      secretKey,
      collateralUnits: 0n,
      stableUnits: 0n,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): StablecoinPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public openVault(collateralUnits: bigint, mintUnits: bigint): Ledger {
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      collateralUnits,
      stableUnits: mintUnits,
    };
    this.circuitContext = this.contract.impureCircuits.openVault(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public addCollateral(collateralUnits: bigint): Ledger {
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      collateralUnits,
      stableUnits: 0n,
    };
    this.circuitContext = this.contract.impureCircuits.addCollateral(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public mintStable(mintUnits: bigint): Ledger {
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      collateralUnits: 0n,
      stableUnits: mintUnits,
    };
    this.circuitContext = this.contract.impureCircuits.mintStable(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public closeVault(): Ledger {
    const current = this.getLedger();
    this.circuitContext.currentPrivateState = {
      ...this.circuitContext.currentPrivateState,
      collateralUnits: current.vaultCollateral,
      stableUnits: current.vaultDebt,
    };
    this.circuitContext = this.contract.impureCircuits.closeVault(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public publicKey(): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "stablecoin-simulator.ts",
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
      sequence,
    ).result;
  }
}
