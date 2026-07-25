import { StablecoinSimulator } from "./stablecoin-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";
import { VaultState } from "../managed/stablecoin/contract/index.js";

setNetworkId("undeployed");

describe("Stablecoin smart contract", () => {
  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const simulator0 = new StablecoinSimulator(key);
    const simulator1 = new StablecoinSimulator(key);
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  it("properly initializes ledger state and private state", () => {
    const key = randomBytes(32);
    const simulator = new StablecoinSimulator(key);
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.sequence).toEqual(1n);
    expect(initialLedgerState.totalSupply).toEqual(0n);
    expect(initialLedgerState.totalCollateral).toEqual(0n);
    expect(initialLedgerState.vaultCollateral).toEqual(0n);
    expect(initialLedgerState.vaultDebt).toEqual(0n);
    expect(initialLedgerState.minCollateralRatioBps).toEqual(15000n);
    expect(initialLedgerState.owner).toEqual(new Uint8Array(32));
    expect(initialLedgerState.vaultState).toEqual(VaultState.CLOSED);
    expect(simulator.getPrivateState()).toEqual({
      secretKey: key,
      collateralUnits: 0n,
      stableUnits: 0n,
    });
  });

  it("lets a user open a vault when collateralized at 150%", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    simulator.openVault(150n, 100n);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.vaultState).toEqual(VaultState.OPEN);
    expect(ledgerState.vaultCollateral).toEqual(150n);
    expect(ledgerState.vaultDebt).toEqual(100n);
    expect(ledgerState.totalCollateral).toEqual(150n);
    expect(ledgerState.totalSupply).toEqual(100n);
    expect(ledgerState.owner).toEqual(simulator.publicKey());
  });

  it("rejects undercollateralized vault opens", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    expect(() => simulator.openVault(149n, 100n)).toThrow(
      "failed assert: Undercollateralized: vault must remain at or above 150%",
    );
  });

  it("lets the owner add collateral and mint more stablecoins", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    simulator.openVault(150n, 100n);
    simulator.addCollateral(30n);
    simulator.mintStable(20n);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.vaultCollateral).toEqual(180n);
    expect(ledgerState.vaultDebt).toEqual(120n);
    expect(ledgerState.totalCollateral).toEqual(180n);
    expect(ledgerState.totalSupply).toEqual(120n);
  });

  it("lets the owner close the vault", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    simulator.openVault(150n, 100n);
    simulator.closeVault();
    const ledgerState = simulator.getLedger();
    expect(ledgerState.vaultState).toEqual(VaultState.CLOSED);
    expect(ledgerState.vaultCollateral).toEqual(0n);
    expect(ledgerState.vaultDebt).toEqual(0n);
    expect(ledgerState.totalCollateral).toEqual(0n);
    expect(ledgerState.totalSupply).toEqual(0n);
    expect(ledgerState.sequence).toEqual(2n);
  });

  it("does not let a different user close the vault", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    simulator.openVault(150n, 100n);
    simulator.switchUser(randomBytes(32));
    expect(() => simulator.closeVault()).toThrow(
      "failed assert: Attempted to close vault, but not the vault owner",
    );
  });

  it("does not allow opening a second vault while one is open", () => {
    const simulator = new StablecoinSimulator(randomBytes(32));
    simulator.openVault(150n, 100n);
    expect(() => simulator.openVault(150n, 100n)).toThrow(
      "failed assert: Attempted to open a vault while one is already open",
    );
  });
});
