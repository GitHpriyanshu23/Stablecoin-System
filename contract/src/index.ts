import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/stablecoin/contract/index.js";
export * from "./witnesses";

import * as CompiledStablecoinContract from "./managed/stablecoin/contract/index.js";
import * as Witnesses from "./witnesses";

export const CompiledStablecoinContractContract = CompiledContract.make<
  CompiledStablecoinContract.Contract<Witnesses.StablecoinPrivateState>
>("Stablecoin", CompiledStablecoinContract.Contract<Witnesses.StablecoinPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/stablecoin"),
);
