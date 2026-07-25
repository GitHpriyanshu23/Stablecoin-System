import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { CardActions, CardContent, IconButton, Tooltip, Typography, Button, Stack } from '@mui/material';
import VaultIcon from '@mui/icons-material/AccountBalanceOutlined';
import CreateBoardIcon from '@mui/icons-material/AddCircleOutlined';
import JoinBoardIcon from '@mui/icons-material/AddLinkOutlined';
import { TextPromptDialog } from './TextPromptDialog';
import { CONTRACT_ADDRESS } from '../../../api/src/index';

/**
 * The props required by the {@link EmptyCardContent} component.
 *
 * @internal
 */
export interface EmptyCardContentProps {
  onCreateBoardCallback: () => void;
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
  defaultContractAddress?: string;
}

/**
 * Used when there is no deployment to render a UI allowing the user to deploy or join.
 *
 * @internal
 */
export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
  defaultContractAddress = CONTRACT_ADDRESS,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);
  const canJoinConfigured =
    !!defaultContractAddress && defaultContractAddress !== CONTRACT_ADDRESS && !defaultContractAddress.includes('<');

  return (
    <React.Fragment>
      <CardContent>
        <Typography align="center" variant="h1" color="primary.dark">
          <VaultIcon fontSize="large" />
        </Typography>
        <Typography data-testid="board-posted-message" align="center" variant="body2" color="primary.dark" sx={{ mb: 1 }}>
          Deploy a new stablecoin system, or join an existing vault contract.
        </Typography>
        <Typography align="center" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Configured address: {defaultContractAddress}
        </Typography>
      </CardContent>
      <CardActions disableSpacing sx={{ justifyContent: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Deploy a new stablecoin contract">
            <IconButton data-testid="board-deploy-btn" onClick={onCreateBoardCallback}>
              <CreateBoardIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Join an existing contract">
            <IconButton
              data-testid="board-join-btn"
              onClick={() => {
                setTextPromptOpen(true);
              }}
            >
              <JoinBoardIcon />
            </IconButton>
          </Tooltip>
          {canJoinConfigured && (
            <Button
              size="small"
              variant="outlined"
              data-testid="join-configured-btn"
              onClick={() => onJoinBoardCallback(defaultContractAddress)}
            >
              Join configured
            </Button>
          )}
        </Stack>
      </CardActions>
      <TextPromptDialog
        prompt="Enter contract address"
        isOpen={textPromptOpen}
        onCancel={() => {
          setTextPromptOpen(false);
        }}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinBoardCallback(text);
        }}
      />
    </React.Fragment>
  );
};
