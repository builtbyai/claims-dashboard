import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Card,
  CardContent,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EmailIcon from '@mui/icons-material/Email';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatDistanceToNow } from 'date-fns';
import { Customer } from '../../types/customer';

// Kanban columns/stages
const KANBAN_STAGES = [
  { id: 'needs_supplement', title: 'Needs Supplement', color: '#f44336' },
  { id: 'supplement_sent', title: 'Supplement Sent', color: '#ff9800' },
  { id: 'under_review', title: 'Under Review', color: '#2196f3' },
  { id: 'approved', title: 'Approved', color: '#4caf50' },
  { id: 'scheduled', title: 'Scheduled', color: '#9c27b0' },
  { id: 'completed', title: 'Completed', color: '#757575' },
];

// Get status color based on conditions
const getStatusColor = (customer: any) => {
  // 🔴 Red - Urgent (80+ photos or waiting > 7 days)
  if (customer.photo_count >= 80 || customer.days_waiting > 7) {
    return '#f44336';
  }

  // 🟡 Yellow - In Progress
  if (customer.status === 'in_progress' || customer.status === 'supplement_sent') {
    return '#ff9800';
  }

  // 🟢 Green - Completed
  if (customer.status === 'completed') {
    return '#4caf50';
  }

  // 🔵 Blue - Scheduled
  if (customer.date_roof_scheduled) {
    return '#2196f3';
  }

  // ⚪ Gray - Pending
  return '#9e9e9e';
};

// Calculate days since supplement sent
const getDaysSinceSupplementSent = (customer: any) => {
  if (!customer.supplement_sent_date) return null;

  const sentDate = new Date(customer.supplement_sent_date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - sentDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// Draggable Card Component
interface DraggableCardProps {
  customer: any;
  onEmailClick: (customer: any) => void;
}

function DraggableCard({ customer, onEmailClick }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: customer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusColor = getStatusColor(customer);
  const daysSinceSupp = getDaysSinceSupplementSent(customer);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 2,
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
        borderLeft: `4px solid ${statusColor}`,
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Customer Name & Job ID */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {customer.name}
          </Typography>
          {customer.job_id && (
            <Chip
              label={`#${customer.job_id}`}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Address */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {customer.property_address}, {customer.city}, {customer.state}
        </Typography>

        {/* Indicators Row */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {/* Photo Count with 80+ warning */}
          {customer.photo_count > 0 && (
            <Tooltip title={`${customer.photo_count} photos${customer.photo_count >= 80 ? ' - SUPPLEMENT NEEDED!' : ''}`}>
              <Chip
                icon={customer.photo_count >= 80 ? <WarningIcon /> : <PhotoCameraIcon />}
                label={customer.photo_count}
                size="small"
                color={customer.photo_count >= 80 ? 'error' : 'default'}
                sx={{ height: 24 }}
              />
            </Tooltip>
          )}

          {/* Days since supplement sent */}
          {daysSinceSupp !== null && (
            <Tooltip title={`${daysSinceSupp} days since supplement sent`}>
              <Chip
                icon={<CalendarTodayIcon />}
                label={`${daysSinceSupp}d`}
                size="small"
                color={daysSinceSupp > 7 ? 'warning' : 'default'}
                sx={{ height: 24 }}
              />
            </Tooltip>
          )}

          {/* Last Email */}
          {customer.last_email_date && (
            <Tooltip title={`Last email: ${formatDistanceToNow(new Date(customer.last_email_date))} ago`}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmailClick(customer);
                }}
                sx={{ p: 0.5 }}
              >
                <Badge
                  color="secondary"
                  variant="dot"
                  invisible={!customer.has_unread_email}
                >
                  <EmailIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Last Email Preview */}
        {customer.last_email_subject && (
          <Box
            sx={{
              bgcolor: 'action.hover',
              p: 1,
              borderRadius: 1,
              mt: 1,
            }}
          >
            <Typography variant="caption" fontWeight="bold" display="block">
              Last Email:
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {customer.last_email_subject.substring(0, 50)}...
            </Typography>
            {customer.last_email_from && (
              <Typography variant="caption" color="primary" display="block" sx={{ fontSize: '0.65rem' }}>
                From: {customer.last_email_from}
              </Typography>
            )}
          </Box>
        )}

        {/* Insurance & Estimate */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {customer.insurance_company && (
            <Typography variant="caption" color="text.secondary">
              🏢 {customer.insurance_company}
            </Typography>
          )}
          {customer.estimate_total && (
            <Typography variant="caption" fontWeight="bold" color="success.main">
              ${customer.estimate_total.toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Next Action */}
        {customer.next_action && (
          <Box
            sx={{
              mt: 1,
              p: 0.5,
              bgcolor: 'warning.light',
              borderRadius: 0.5,
            }}
          >
            <Typography variant="caption" fontWeight="bold" color="warning.dark">
              ⚡ {customer.next_action}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// Kanban Column Component
interface ColumnProps {
  stage: typeof KANBAN_STAGES[0];
  customers: any[];
  onEmailClick: (customer: any) => void;
}

function KanbanColumn({ stage, customers, onEmailClick }: ColumnProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        minWidth: 300,
        maxWidth: 350,
        bgcolor: '#f5f5f5',
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          pb: 1,
          borderBottom: `3px solid ${stage.color}`,
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {stage.title}
        </Typography>
        <Chip
          label={customers.length}
          size="small"
          sx={{
            bgcolor: stage.color,
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      </Box>

      {/* Cards Container */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {customers.map((customer) => (
            <DraggableCard
              key={customer.id}
              customer={customer}
              onEmailClick={onEmailClick}
            />
          ))}
        </SortableContext>

        {customers.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">No customers</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// Main Kanban Board
interface KanbanBoardProps {
  customers: any[];
  onCustomerMove: (customerId: number, newStage: string) => void;
  onEmailClick: (customer: any) => void;
}

export default function KanbanBoard({ customers, onCustomerMove, onEmailClick }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [customersByStage, setCustomersByStage] = useState<{ [key: string]: any[] }>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group customers by stage
  useEffect(() => {
    const grouped = KANBAN_STAGES.reduce((acc, stage) => {
      acc[stage.id] = customers.filter(c => c.kanban_stage === stage.id || (!c.kanban_stage && stage.id === 'needs_supplement'));
      return acc;
    }, {} as { [key: string]: any[] });

    setCustomersByStage(grouped);
  }, [customers]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // Find which column the card was dropped into
    const overId = over.id as string;

    // Check if dropped on a column
    const targetStage = KANBAN_STAGES.find(s => s.id === overId);

    if (targetStage) {
      onCustomerMove(active.id as number, targetStage.id);
    }

    setActiveId(null);
  };

  const activeCustomer = activeId
    ? customers.find(c => c.id === activeId)
    : null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        📋 Supplement Workflow
      </Typography>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            pb: 2,
          }}
        >
          {KANBAN_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              customers={customersByStage[stage.id] || []}
              onEmailClick={onEmailClick}
            />
          ))}
        </Box>

        <DragOverlay>
          {activeCustomer ? (
            <Card sx={{ width: 300, opacity: 0.9 }}>
              <CardContent>
                <Typography variant="subtitle2">{activeCustomer.name}</Typography>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}
