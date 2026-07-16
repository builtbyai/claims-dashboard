import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Dialog,
  DialogContent,
  IconButton,
  Chip,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FolderIcon from '@mui/icons-material/Folder';

interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string;
  category: string;
  filename: string;
  size?: number;
  created_at?: string;
  metadata?: any;
}

interface PhotoGalleryProps {
  customerId: number;
  jobId?: string;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function PhotoGallery({ customerId, jobId }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, [customerId]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);

      // Try to fetch from API first
      let response = await fetch(`${API_BASE}/customers/${customerId}/photos`);

      if (!response.ok && jobId) {
        // Fallback to local photos directory
        response = await fetch(`/photos/job_${jobId}/index.json`);
      }

      if (!response.ok) {
        throw new Error('No photos found for this customer');
      }

      const data = await response.json();
      const photosData = data.photos || data || [];

      // If we got a local directory listing, convert to photo objects
      const formattedPhotos = photosData.map((photo: any, index: number) => {
        if (typeof photo === 'string') {
          // It's a filename from directory listing
          const category = photo.split('_')[0] || 'general';
          return {
            id: `photo-${index}`,
            url: `/photos/job_${jobId}/${photo}`,
            thumbnail_url: `/photos/job_${jobId}/${photo}`,
            category,
            filename: photo,
          };
        }
        return photo;
      });

      setPhotos(formattedPhotos);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      setError(err.message || 'Failed to load photos');

      // Try to load from local directory as last resort
      if (jobId) {
        try {
          const localPhotos = await loadLocalPhotos(jobId);
          setPhotos(localPhotos);
          setError(null);
        } catch (localErr) {
          // Keep the original error
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLocalPhotos = async (jobId: string): Promise<Photo[]> => {
    // Load photos from local photos directory
    const photoFiles = [
      'decking_ios_1.jpeg',
      'felt_paper_ios_1.jpeg',
      'gutters_ios_1.jpeg',
      'house_overview_ios_1.jpeg',
      'roofing_accessories_ios_1.jpeg',
      'roofing_overview_ios_1.jpeg',
    ];

    return photoFiles.map((filename, index) => {
      const category = filename.split('_')[0];
      return {
        id: `local-${index}`,
        url: `/photos/job_${jobId}/${filename}`,
        thumbnail_url: `/photos/job_${jobId}/${filename}`,
        category,
        filename,
      };
    });
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(photos.map(p => p.category)))];

  // Filter photos by category
  const filteredPhotos = selectedCategory === 'all'
    ? photos
    : photos.filter(p => p.category === selectedCategory);

  const handlePhotoClick = (photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setCurrentPhotoIndex(index);
  };

  const handleCloseDialog = () => {
    setSelectedPhoto(null);
  };

  const handleNextPhoto = () => {
    const nextIndex = (currentPhotoIndex + 1) % filteredPhotos.length;
    setCurrentPhotoIndex(nextIndex);
    setSelectedPhoto(filteredPhotos[nextIndex]);
  };

  const handlePrevPhoto = () => {
    const prevIndex = (currentPhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    setCurrentPhotoIndex(prevIndex);
    setSelectedPhoto(filteredPhotos[prevIndex]);
  };

  const handleDownloadPhoto = (photo: Photo) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.filename;
    link.click();
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      decking: '🏗️',
      felt_paper: '📄',
      gutters: '🌊',
      house_overview: '🏠',
      roofing_accessories: '🔧',
      roofing_overview: '🏘️',
      general: '📸',
    };
    return icons[category] || '📸';
  };

  const getCategoryCount = (category: string) => {
    if (category === 'all') return photos.length;
    return photos.filter(p => p.category === category).length;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 5 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading photos...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          {error}
          <br />
          <Typography variant="caption">
            Photos will be available after download script runs for job #{jobId}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (photos.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 5 }}>
        <PhotoCameraIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No photos available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Photos will appear here after they are downloaded
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Category Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(e, newValue) => setSelectedCategory(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {categories.map(category => (
            <Tab
              key={category}
              value={category}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{getCategoryIcon(category)}</span>
                  <span>{category.replace(/_/g, ' ').toUpperCase()}</span>
                  <Badge badgeContent={getCategoryCount(category)} color="primary" />
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* Photo Grid */}
      <Grid container spacing={2}>
        {filteredPhotos.map((photo, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={photo.id}>
            <Card
              sx={{
                position: 'relative',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: 6,
                },
              }}
              onClick={() => handlePhotoClick(photo, index)}
            >
              <CardMedia
                component="img"
                height="200"
                image={photo.thumbnail_url || photo.url}
                alt={photo.filename}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={photo.category}
                    size="small"
                    icon={<span>{getCategoryIcon(photo.category)}</span>}
                  />
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPhoto(photo);
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" display="block" noWrap sx={{ mt: 1 }}>
                  {photo.filename}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Photo Viewer Dialog */}
      <Dialog
        open={!!selectedPhoto}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.95)',
            color: 'white',
          },
        }}
      >
        <DialogContent>
          <Box sx={{ position: 'relative' }}>
            {/* Close Button */}
            <IconButton
              onClick={handleCloseDialog}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                zIndex: 1,
              }}
            >
              <CloseIcon />
            </IconButton>

            {/* Previous Button */}
            <IconButton
              onClick={handlePrevPhoto}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                zIndex: 1,
              }}
            >
              <NavigateBeforeIcon />
            </IconButton>

            {/* Next Button */}
            <IconButton
              onClick={handleNextPhoto}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.7)' },
                zIndex: 1,
              }}
            >
              <NavigateNextIcon />
            </IconButton>

            {/* Image */}
            {selectedPhoto && (
              <Box>
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.filename}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                  }}
                />

                {/* Photo Info */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6">{selectedPhoto.filename}</Typography>
                    <Typography variant="body2" color="grey.400">
                      Category: {selectedPhoto.category} | {currentPhotoIndex + 1} of {filteredPhotos.length}
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => handleDownloadPhoto(selectedPhoto)}
                    sx={{ color: 'white' }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
