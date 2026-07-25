import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { MainLayout, Board } from './components';
import { useDeployedBoardContext } from './hooks';
import { type BoardDeployment } from './contexts';
import { type Observable } from 'rxjs';

/**
 * The root stablecoin application component.
 *
 * @internal
 */
const App: React.FC = () => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployments, setBoardDeployments] = useState<Array<Observable<BoardDeployment>>>([]);

  useEffect(() => {
    const subscription = boardApiProvider.boardDeployments$.subscribe(setBoardDeployments);

    return () => {
      subscription.unsubscribe();
    };
  }, [boardApiProvider]);

  return (
    <Box
      sx={{
        background: 'radial-gradient(circle at top, #0f2a24 0%, #06110e 45%, #020605 100%)',
        minHeight: '100vh',
      }}
    >
      <MainLayout>
        <Stack spacing={2} sx={{ mb: 3, px: 2, maxWidth: 720 }}>
          <Typography variant="h4" sx={{ color: '#d7f5ea', fontWeight: 700 }}>
            Stablecoin System
          </Typography>
          <Typography variant="body1" sx={{ color: '#9cb8ad' }}>
            Collateral-backed stablecoin pegged to fiat. Lock collateral, mint privately-authorized
            stablecoins, and prove vault ownership without revealing your secret key.
          </Typography>
        </Stack>
        {boardDeployments.map((boardDeployment, idx) => (
          <div data-testid={`board-${idx}`} key={`board-${idx}`}>
            <Board boardDeployment$={boardDeployment} />
          </div>
        ))}
        <div data-testid="board-start">
          <Board />
        </div>
      </MainLayout>
    </Box>
  );
};

export default App;
