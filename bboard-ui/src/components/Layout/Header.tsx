import React from 'react';
import { AppBar, Box, Typography } from '@mui/material';

/**
 * Application header for the stablecoin DApp.
 */
export const Header: React.FC = () => (
  <AppBar
    position="static"
    data-testid="header"
    sx={{
      backgroundColor: 'transparent',
      boxShadow: 'none',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(215, 245, 234, 0.12)',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        px: 4,
        py: 2,
        alignItems: 'center',
        gap: 2,
      }}
      data-testid="header-logo"
    >
      <img src="/midnight-logo.png" alt="Midnight logo" height={48} />
      <Typography variant="h6" sx={{ color: '#d7f5ea', letterSpacing: '0.04em' }}>
        Stablecoin System
      </Typography>
    </Box>
  </AppBar>
);
