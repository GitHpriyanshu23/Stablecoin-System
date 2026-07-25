import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Typography,
  TextField,
  Stack,
  Button,
  Box,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import { type StablecoinDerivedState, type DeployedStablecoinAPI } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { VaultState } from '../../../contract/src/index';
import { EmptyCardContent } from './Board.EmptyCardContent';

/** The props required by the {@link Board} component. */
export interface BoardProps {
  /** The observable stablecoin deployment. */
  boardDeployment$?: Observable<BoardDeployment>;
}

/**
 * Provides the UI for a deployed stablecoin vault contract.
 */
export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedStablecoinAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<StablecoinDerivedState>();
  const [collateralInput, setCollateralInput] = useState('150');
  const [stableInput, setStableInput] = useState('100');
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);

  const onCreateBoard = useCallback(() => boardApiProvider.resolve(), [boardApiProvider]);
  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) => boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      try {
        if (!deployedBoardAPI) {
          return;
        }
        setIsWorking(true);
        setErrorMessage(undefined);
        await action();
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
      }
    },
    [deployedBoardAPI],
  );

  const onOpenVault = useCallback(() => {
    const collateral = Number(collateralInput);
    const mint = Number(stableInput);
    if (!Number.isFinite(collateral) || !Number.isFinite(mint)) {
      setErrorMessage('Enter valid numeric amounts');
      return;
    }
    void runAction(() => deployedBoardAPI!.openVault(collateral, mint));
  }, [collateralInput, stableInput, runAction, deployedBoardAPI]);

  const onAddCollateral = useCallback(() => {
    const collateral = Number(collateralInput);
    if (!Number.isFinite(collateral)) {
      setErrorMessage('Enter a valid collateral amount');
      return;
    }
    void runAction(() => deployedBoardAPI!.addCollateral(collateral));
  }, [collateralInput, runAction, deployedBoardAPI]);

  const onMintStable = useCallback(() => {
    const mint = Number(stableInput);
    if (!Number.isFinite(mint)) {
      setErrorMessage('Enter a valid mint amount');
      return;
    }
    void runAction(() => deployedBoardAPI!.mintStable(mint));
  }, [stableInput, runAction, deployedBoardAPI]);

  const onCloseVault = useCallback(() => {
    void runAction(() => deployedBoardAPI!.closeVault());
  }, [runAction, deployedBoardAPI]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(deployedBoardAPI.deployedContractAddress);
    }
  }, [deployedBoardAPI]);

  useEffect(() => {
    if (!boardDeployment$) {
      return;
    }

    const subscription = boardDeployment$.subscribe(setBoardDeployment);

    return () => {
      subscription.unsubscribe();
    };
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment) {
      return;
    }
    if (boardDeployment.status === 'in-progress') {
      return;
    }

    setIsWorking(false);

    if (boardDeployment.status === 'failed') {
      setErrorMessage(
        boardDeployment.error.message.length ? boardDeployment.error.message : 'Encountered an unexpected error.',
      );
      return;
    }

    setDeployedBoardAPI(boardDeployment.api);
    const subscription = boardDeployment.api.state$.subscribe(setBoardState);
    return () => {
      subscription.unsubscribe();
    };
  }, [boardDeployment]);

  const vaultOpen = boardState?.vaultState === VaultState.OPEN;

  return (
    <Card
      sx={{ position: 'relative', width: 360, minWidth: 320, minHeight: 420 }}
      color="primary"
      data-testid="stablecoin-vault-card"
    >
      {!boardDeployment$ && (
        <EmptyCardContent
          onCreateBoardCallback={onCreateBoard}
          onJoinBoardCallback={onJoinBoard}
          defaultContractAddress={boardApiProvider.configuredContractAddress}
        />
      )}

      {boardDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="board-working-indicator" />
          </Backdrop>
          <Backdrop
            sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
            onClick={() => setErrorMessage(undefined)}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="board-error-message" sx={{ px: 2 }}>
              {errorMessage}
            </Typography>
          </Backdrop>
          <CardHeader
            avatar={
              boardState ? (
                vaultOpen && !boardState.isOwner ? (
                  <LockIcon data-testid="vault-locked-icon" />
                ) : (
                  <LockOpenIcon data-testid="vault-unlocked-icon" />
                )
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
            titleTypographyProps={{ color: 'primary' }}
            title={toShortFormatContractAddress(deployedBoardAPI?.deployedContractAddress) ?? 'Loading...'}
            subheader={vaultOpen ? 'Vault open' : 'Vault closed'}
            action={
              deployedBoardAPI?.deployedContractAddress ? (
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
          />
          <CardContent>
            {boardState ? (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="primary" data-testid="vault-stats">
                  Supply: {boardState.totalSupply.toString()} · Collateral:{' '}
                  {boardState.totalCollateral.toString()}
                </Typography>
                <Typography variant="body2" color="primary">
                  Vault debt: {boardState.vaultDebt.toString()} · Vault collateral:{' '}
                  {boardState.vaultCollateral.toString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Min ratio: {(Number(boardState.minCollateralRatioBps) / 100).toFixed(0)}% · Owner:{' '}
                  {boardState.isOwner ? 'you' : vaultOpen ? 'someone else' : 'none'}
                </Typography>
                <Box>
                  <TextField
                    label="Collateral units"
                    size="small"
                    fullWidth
                    value={collateralInput}
                    onChange={(e) => setCollateralInput(e.target.value)}
                    sx={{ mb: 1 }}
                    slotProps={{ htmlInput: { style: { color: 'black' } } }}
                  />
                  <TextField
                    label="Stablecoin units"
                    size="small"
                    fullWidth
                    value={stableInput}
                    onChange={(e) => setStableInput(e.target.value)}
                    slotProps={{ htmlInput: { style: { color: 'black' } } }}
                  />
                </Box>
              </Stack>
            ) : (
              <Skeleton variant="rectangular" width={320} height={180} />
            )}
          </CardContent>
          <CardActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
            {deployedBoardAPI ? (
              <React.Fragment>
                <Button
                  size="small"
                  variant="contained"
                  disabled={vaultOpen}
                  onClick={onOpenVault}
                  data-testid="open-vault-btn"
                >
                  Open vault
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!vaultOpen || !boardState?.isOwner}
                  onClick={onAddCollateral}
                  data-testid="add-collateral-btn"
                >
                  Add collateral
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!vaultOpen || !boardState?.isOwner}
                  onClick={onMintStable}
                  data-testid="mint-stable-btn"
                >
                  Mint
                </Button>
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  disabled={!vaultOpen || !boardState?.isOwner}
                  onClick={onCloseVault}
                  data-testid="close-vault-btn"
                >
                  Close vault
                </Button>
              </React.Fragment>
            ) : (
              <Skeleton variant="rectangular" width={180} height={28} />
            )}
          </CardActions>
        </React.Fragment>
      )}
    </Card>
  );
};

/** @internal */
const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  contractAddress ? (
    <span data-testid="board-address">
      0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;
