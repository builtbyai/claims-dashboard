import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Box,
  Badge,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { FolderInfo } from '../../types/customer';

interface FolderBrowserProps {
  folders: FolderInfo[];
}

const getFolderIcon = (folderName: string) => {
  const name = folderName.toLowerCase();
  if (name.includes('photo')) return <PhotoLibraryIcon fontSize="large" />;
  if (name.includes('supplement')) return <DescriptionIcon fontSize="large" />;
  if (name.includes('estimate')) return <AttachMoneyIcon fontSize="large" />;
  if (name.includes('correspondence')) return <EmailIcon fontSize="large" />;
  if (name.includes('insurance')) return <BusinessIcon fontSize="large" />;
  if (name.includes('invoice')) return <ReceiptIcon fontSize="large" />;
  return <FolderIcon fontSize="large" />;
};

const FolderBrowser: React.FC<FolderBrowserProps> = ({ folders }) => {
  if (folders.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Folder Structure
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No folders available.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Folder Structure
        </Typography>

        <Grid container spacing={2}>
          {folders.map((folder, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Paper
                elevation={2}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    elevation: 6,
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Badge
                    badgeContent={folder.file_count}
                    color="primary"
                    max={999}
                  >
                    <Box sx={{ color: 'primary.main' }}>
                      {getFolderIcon(folder.name)}
                    </Box>
                  </Badge>
                  <Typography
                    variant="subtitle2"
                    align="center"
                    sx={{ fontWeight: 600 }}
                  >
                    {folder.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {folder.file_count} {folder.file_count === 1 ? 'file' : 'files'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default FolderBrowser;
