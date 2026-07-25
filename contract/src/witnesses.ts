/*
 * Private state shape and witness implementations for the stablecoin contract.
 */

import { Ledger } from "./managed/stablecoin/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type StablecoinPrivateState = {
  readonly secretKey: Uint8Array;
  readonly collateralUnits: bigint;
  readonly stableUnits: bigint;
};

export const createStablecoinPrivateState = (
  secretKey: Uint8Array,
  collateralUnits: bigint = 0n,
  stableUnits: bigint = 0n,
): StablecoinPrivateState => ({
  secretKey,
  collateralUnits,
  stableUnits,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, StablecoinPrivateState>): [StablecoinPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  privateCollateralUnits: ({
    privateState,
  }: WitnessContext<Ledger, StablecoinPrivateState>): [StablecoinPrivateState, bigint] => [
    privateState,
    privateState.collateralUnits,
  ],

  privateStableUnits: ({
    privateState,
  }: WitnessContext<Ledger, StablecoinPrivateState>): [StablecoinPrivateState, bigint] => [
    privateState,
    privateState.stableUnits,
  ],
};
