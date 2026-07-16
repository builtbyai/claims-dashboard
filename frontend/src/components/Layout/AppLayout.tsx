import React, { ReactNode } from 'react';
import { Box, Toolbar, Container } from '@mui/material';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
  onSearch?: (query: string) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, onSearch }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <TopBar onSearch={onSearch} />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: (theme) => theme.palette.grey[100],
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
