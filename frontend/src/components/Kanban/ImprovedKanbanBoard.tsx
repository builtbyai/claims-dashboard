import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Badge,
  Snackbar,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EmailIcon from '@mui/icons-material/Email';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningIcon from '@mui/icons-material/Warning';
import UndoIcon from '@mui/icons-material/Undo';
import { formatDistanceToNow } from 'date-fns';

// Kanban stages
const KANBAN_STAGES = [
  { id: 'needs_supplement', title: 'Needs Supplement', color: '#f44336' },
  { id: 'supplement_sent', title: 'Supplement Sent', color: '#ff9800' },
  { id: 'under_review', title: 'Under Review', color: '#2196f3' },
  { id: 'approved', title: 'Approved', color: '#4caf50' },
  { id: 'scheduled', title: 'Scheduled', color: '#9c27b0' },
  { id: 'completed', title: 'Completed', color: '#757575' },
];

// Get status color
const getStatusColor = (customer: any) => {
  if (customer.photo_count >= 80 || customer.days_waiting > 7) {
    return '#f44336';
  }
  if (customer.status === 'in_progress' || customer.status === 'supplement_sent') {
    return '#ff9800';
  }
  if (customer.status === 'completed') {
    return '#4caf50';
  }
  if (customer.date_roof_scheduled) {
    return '#2196f3';
  }
  return '#9e9e9e';
};

// Calculate days since supplement sent
const getDaysSinceSupplementSent = (customer: any) => {
  if (!customer.supplement_sent_date) return null;
  const sentDate = new Date(customer.supplement_sent_date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - sentDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Draggable Card Component with IMPROVED animations
interface DraggableCardProps {
  customer: any;
  onEmailClick: (customer: any) => void;
  isOverlay?: boolean;
}

function DraggableCard({ customer, onEmailClick, isOverlay = false }: DraggableCardProps) {
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
    transition: transition || 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.4 : 1,
    scale: isDragging ? 1.05 : 1,
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
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.2s ease-in-out',
        backgroundColor: isOverlay ? 'background.paper' : 'white',
      }}
      tabIndex={0}
      role="button"
      aria-label={`Drag ${customer.name} card`}
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
          <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1, mt: 1 }}>
            <Typography variant="caption" fontWeight="bold" display="block">
              Last Email:
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {customer.last_email_subject.substring(0, 50)}...
            </Typography>
          </Box>
        )}

        {/* Insurance & Estimate */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {customer.insurance_company && (
            <Typography variant="caption" color="text.secondary">
              {customer.insurance_company}
            </Typography>
          )}
          {customer.estimate_total && (
            <Typography variant="caption" fontWeight="bold" color="success.main">
              ${customer.estimate_total.toLocaleString()}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// Droppable Column Component with IMPROVED visual feedback
interface ColumnProps {
  stage: typeof KANBAN_STAGES[0];
  customers: any[];
  onEmailClick: (customer: any) => void;
  isOver: boolean;
}

function KanbanColumn({ stage, customers, onEmailClick, isOver }: ColumnProps) {
  return (
    <Paper
      elevation={isOver ? 8 : 2}
      sx={{
        p: 2,
        minWidth: 300,
        maxWidth: 350,
        bgcolor: isOver ? 'action.hover' : '#f5f5f5',
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
        border: isOver ? `2px dashed ${stage.color}` : 'none',
      }}
      role="region"
      aria-label={`${stage.title} column`}
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
              opacity: isOver ? 1 : 0.5,
            }}
          >
            <Typography variant="body2">
              {isOver ? 'Drop here' : 'No customers'}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// Main Improved Kanban Board
interface ImprovedKanbanBoardProps {
  customers: any[];
  onCustomerMove: (customerId: number, newStage: string) => Promise<void>;
  onEmailClick: (customer: any) => void;
}

export default function ImprovedKanbanBoard({ customers, onCustomerMove, onEmailClick }: ImprovedKanbanBoardProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [customersByStage, setCustomersByStage] = useState<{ [key: string]: any[] }>({});
  const [overId, setOverId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Array<{ customerId: number; fromStage: string; toStage: string }>>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Sensors with KEYBOARD navigation support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const customerId = active.id as number;
    const customer = customers.find(c => c.id === customerId);
    const fromStage = customer?.kanban_stage || 'needs_supplement';

    // Find which column the card was dropped into
    let targetStage = KANBAN_STAGES.find(s => s.id === over.id)?.id;

    // If dropped on a card, find the stage of that card
    if (!targetStage) {
      const targetCustomer = customers.find(c => c.id === over.id);
      targetStage = targetCustomer?.kanban_stage;
    }

    if (targetStage && targetStage !== fromStage && customer) {
      // OPTIMISTIC UPDATE - Update UI immediately
      setCustomersByStage(prev => {
        const newState = { ...prev };
        newState[fromStage] = newState[fromStage].filter(c => c.id !== customerId);
        // TypeScript type assertion since we verified targetStage is defined
        newState[targetStage as string] = [...(newState[targetStage as string] || []), customer];
        return newState;
      });

      setIsUpdating(true);

      try {
        // API call in background
        await onCustomerMove(customerId, targetStage);

        // Add to undo stack
        setUndoStack(prev => [...prev, { customerId, fromStage, toStage: targetStage! }]);

        // Show success with HAPTIC feedback (visual pulse)
        setSnackbar({
          open: true,
          message: `Moved ${customer?.name} to ${KANBAN_STAGES.find(s => s.id === targetStage)?.title}`,
          severity: 'success',
        });
      } catch (error) {
        // UNDO on failure
        setCustomersByStage(prev => {
          const newState = { ...prev };
          newState[targetStage!] = newState[targetStage!].filter(c => c.id !== customerId);
          newState[fromStage] = [...(newState[fromStage] || []), customer];
          return newState;
        });

        setSnackbar({
          open: true,
          message: `Failed to move ${customer?.name}. Please try again.`,
          severity: 'error',
        });
      } finally {
        setIsUpdating(false);
      }
    }

    setActiveId(null);
    setOverId(null);
  };

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    const customer = customers.find(c => c.id === lastAction.customerId);

    if (customer) {
      onCustomerMove(lastAction.customerId, lastAction.fromStage);
      setUndoStack(prev => prev.slice(0, -1));

      setSnackbar({
        open: true,
        message: `Undone: Moved ${customer.name} back to ${KANBAN_STAGES.find(s => s.id === lastAction.fromStage)?.title}`,
        severity: 'info',
      });
    }
  }, [undoStack, customers, onCustomerMove]);

  const activeCustomer = activeId ? customers.find(c => c.id === activeId) : null;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Undo button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          Supplement Workflow
        </Typography>

        {undoStack.length > 0 && (
          <Tooltip title="Undo last move">
            <IconButton onClick={handleUndo} color="primary">
              <UndoIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Loading indicator */}
      {isUpdating && <LinearProgress sx={{ mb: 2 }} />}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
              isOver={overId === stage.id}
            />
          ))}
        </Box>

        {/* Improved Drag Overlay with full card preview */}
        <DragOverlay>
          {activeCustomer ? (
            <DraggableCard
              customer={activeCustomer}
              onEmailClick={onEmailClick}
              isOverlay={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
