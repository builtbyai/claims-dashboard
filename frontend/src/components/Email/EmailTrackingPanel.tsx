import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Badge,
  Tooltip,
  Button,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ReplyIcon from '@mui/icons-material/Reply';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import { formatDistanceToNow, format } from 'date-fns';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  preview: string;
  hasAttachment: boolean;
  isUnread: boolean;
  isUrgent: boolean;
  category: 'estimate' | 'supplement' | 'approval' | 'denial' | 'question' | 'other';
}

interface EmailTrackingPanelProps {
  customerId: number;
  customerName: string;
  emails: Email[];
  onEmailClick?: (emailId: string) => void;
  onReply?: (emailId: string) => void;
  onComposeNew?: () => void;
}

// Get category color
const getCategoryColor = (category: string) => {
  const colors: { [key: string]: string } = {
    estimate: '#2196f3',
    supplement: '#ff9800',
    approval: '#4caf50',
    denial: '#f44336',
    question: '#9c27b0',
    other: '#757575',
  };
  return colors[category] || colors.other;
};

// Get category icon
const getCategoryLabel = (category: string) => {
  const labels: { [key: string]: string } = {
    estimate: 'Estimate',
    supplement: 'Supplement',
    approval: 'Approval',
    denial: 'Denial',
    question: 'Question',
    other: 'Other',
  };
  return labels[category] || 'Other';
};

// Parse next action from email
const getNextAction = (email: Email): string | null => {
  const subjectLower = email.subject.toLowerCase();
  const previewLower = email.preview.toLowerCase();

  if (subjectLower.includes('approval') || previewLower.includes('approved')) {
    return 'Schedule install';
  }

  if (subjectLower.includes('denial') || subjectLower.includes('rejected')) {
    return 'Review and resubmit';
  }

  if (subjectLower.includes('question') || previewLower.includes('clarification')) {
    return 'Respond to inquiry';
  }

  if (subjectLower.includes('supplement') && subjectLower.includes('need')) {
    return 'Prepare supplement';
  }

  if (subjectLower.includes('waiting') || previewLower.includes('pending')) {
    return 'Follow up';
  }

  return null;
};

export default function EmailTrackingPanel({
  customerId,
  customerName,
  emails,
  onEmailClick,
  onReply,
  onComposeNew,
}: EmailTrackingPanelProps) {
  // Sort emails by date (most recent first)
  const sortedEmails = [...emails].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Get unread count
  const unreadCount = emails.filter(e => e.isUnread).length;

  // Get most recent email
  const latestEmail = sortedEmails[0];

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Email Correspondence
            </Typography>
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error">
                <Chip label="Unread" size="small" color="error" />
              </Badge>
            )}
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<EmailIcon />}
            onClick={onComposeNew}
          >
            Compose
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Correspondence for {customerName}
        </Typography>
      </Box>

      {/* Latest Email Summary */}
      {latestEmail && (
        <Box
          sx={{
            p: 2,
            bgcolor: latestEmail.isUnread ? 'action.hover' : 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Latest Email
            </Typography>
            <Chip
              label={getCategoryLabel(latestEmail.category)}
              size="small"
              sx={{
                bgcolor: getCategoryColor(latestEmail.category),
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          </Box>

          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {latestEmail.subject}
          </Typography>

          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            From: {latestEmail.from}
          </Typography>

          <Typography variant="caption" color="primary" display="block" gutterBottom>
            📅 {formatDistanceToNow(new Date(latestEmail.date))} ago
            ({format(new Date(latestEmail.date), 'MMM dd, yyyy h:mm a')})
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {latestEmail.preview}
          </Typography>

          {/* Next Action */}
          {getNextAction(latestEmail) && (
            <Box
              sx={{
                mt: 2,
                p: 1,
                bgcolor: 'warning.light',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <PriorityHighIcon sx={{ color: 'warning.dark' }} />
              <Typography variant="caption" fontWeight="bold" color="warning.dark">
                Next Action: {getNextAction(latestEmail)}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplyIcon />}
              onClick={() => onReply && onReply(latestEmail.id)}
            >
              Reply
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => onEmailClick && onEmailClick(latestEmail.id)}
            >
              View Full
            </Button>
          </Box>
        </Box>
      )}

      {/* Email History List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List dense>
          {sortedEmails.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No emails found for this customer
              </Typography>
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 2 }}
                onClick={onComposeNew}
              >
                Send First Email
              </Button>
            </Box>
          ) : (
            sortedEmails.map((email, index) => (
              <React.Fragment key={email.id}>
                <ListItem
                  button
                  onClick={() => onEmailClick && onEmailClick(email.id)}
                  sx={{
                    bgcolor: email.isUnread ? 'action.hover' : 'transparent',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      color="error"
                      variant="dot"
                      invisible={!email.isUnread}
                    >
                      <Avatar
                        sx={{
                          bgcolor: getCategoryColor(email.category),
                          width: 40,
                          height: 40,
                        }}
                      >
                        {email.category === 'approval' ? (
                          <CheckCircleIcon />
                        ) : email.category === 'denial' ? (
                          <PriorityHighIcon />
                        ) : email.category === 'supplement' ? (
                          <ScheduleSendIcon />
                        ) : (
                          <EmailIcon />
                        )}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={email.isUnread ? 'bold' : 'normal'}
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {email.subject}
                        </Typography>
                        {email.hasAttachment && (
                          <Tooltip title="Has attachment">
                            <AttachFileIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="caption" display="block">
                          {email.from}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary" display="block">
                          {email.preview.substring(0, 80)}...
                        </Typography>
                        <Typography component="span" variant="caption" color="primary">
                          {formatDistanceToNow(new Date(email.date))} ago
                        </Typography>
                      </>
                    }
                  />

                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                    <Chip
                      label={getCategoryLabel(email.category)}
                      size="small"
                      sx={{
                        bgcolor: getCategoryColor(email.category),
                        color: 'white',
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReply && onReply(email.id);
                      }}
                    >
                      <ReplyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </ListItem>
                {index < sortedEmails.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </Box>

      {/* Footer Stats */}
      {emails.length > 0 && (
        <Box
          sx={{
            p: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              {emails.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Emails
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold" color="error">
              {unreadCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unread
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold" color="success.main">
              {emails.filter(e => e.category === 'approval').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Approvals
            </Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
