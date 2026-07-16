import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Paper,
  Box,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import { Activity } from '../../types/customer';
import { formatDateTime } from '../../utils/formatters';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PhotoIcon from '@mui/icons-material/Photo';
import UpdateIcon from '@mui/icons-material/Update';
import CreateIcon from '@mui/icons-material/Create';

interface TimelinePanelProps {
  activities: Activity[];
}

const getActivityIcon = (activityType: string) => {
  switch (activityType.toLowerCase()) {
    case 'photo uploaded':
    case 'photo_uploaded':
      return <PhotoIcon />;
    case 'supplement created':
    case 'supplement_created':
      return <NoteAddIcon />;
    case 'customer created':
    case 'created':
      return <CreateIcon />;
    default:
      return <UpdateIcon />;
  }
};

const getActivityColor = (activityType: string): 'primary' | 'secondary' | 'success' | 'info' => {
  switch (activityType.toLowerCase()) {
    case 'photo uploaded':
    case 'photo_uploaded':
      return 'info';
    case 'supplement created':
    case 'supplement_created':
      return 'success';
    case 'customer created':
    case 'created':
      return 'primary';
    default:
      return 'secondary';
  }
};

const TimelinePanel: React.FC<TimelinePanelProps> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Activity Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No activities recorded yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Activity Timeline
        </Typography>

        <Timeline position="alternate">
          {activities.map((activity, index) => (
            <TimelineItem key={activity.id}>
              <TimelineOppositeContent color="text.secondary">
                <Typography variant="caption">
                  {formatDateTime(activity.activity_date || activity.created_at)}
                </Typography>
              </TimelineOppositeContent>

              <TimelineSeparator>
                <TimelineDot color={getActivityColor(activity.activity_type)}>
                  {getActivityIcon(activity.activity_type)}
                </TimelineDot>
                {index < activities.length - 1 && <TimelineConnector />}
              </TimelineSeparator>

              <TimelineContent>
                <Paper elevation={3} sx={{ p: 2 }}>
                  <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 600 }}>
                    {activity.activity_type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activity.description}
                  </Typography>
                  {activity.attachments && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Attachments: {activity.attachments}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </CardContent>
    </Card>
  );
};

export default TimelinePanel;
