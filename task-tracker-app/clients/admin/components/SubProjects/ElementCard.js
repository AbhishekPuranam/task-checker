import { memo } from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import { Info as InfoIcon, Work as WorkIcon } from '@mui/icons-material';

// Memoized Element Card for performance
const ElementCard = memo(({ 
  element, 
  onMoreDetails, 
  onManageJobs,
  statusColors,
  workflowColors 
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        bgcolor: '#fff',
        borderLeft: `3px solid ${statusColors.border}`,
        borderRadius: 1,
        transition: 'all 0.15s ease',
        '&:hover': {
          transform: 'translateX(2px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          bgcolor: '#fafafa'
        }
      }}
    >
      {/* Serial */}
      <Chip 
        label={`#${element.serialNo}`}
        size="small"
        sx={{ 
          fontWeight: 600,
          minWidth: '50px',
          bgcolor: statusColors.border,
          color: '#fff'
        }}
      />
      
      {/* Core Info */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Field label="Level" value={element.level} minWidth="80px" />
        <Field label="Grid" value={element.gridNo} minWidth="90px" />
        <Field label="Part Mark" value={element.partMarkNo} minWidth="90px" />
        <Field label="Length" value={element.lengthMm} minWidth="80px" />
        <Field 
          label="SQM" 
          value={element.surfaceAreaSqm?.toFixed(2)} 
          minWidth="70px"
          highlight 
        />
        <Field label="Qty" value={element.qty || 1} minWidth="60px" />
        
        {/* Workflow Badge */}
        {element.fireProofingWorkflow && (
          <Box sx={{ minWidth: '120px' }}>
            <Chip 
              label={element.fireProofingWorkflow.replace(/_/g, ' ')}
              size="small"
              sx={{
                fontSize: '0.7rem',
                height: '24px',
                bgcolor: workflowColors.bg,
                color: workflowColors.text,
                textTransform: 'capitalize',
                fontWeight: 600
              }}
            />
          </Box>
        )}
        
        {/* Current Job */}
        {element.currentJob && (
          <Box sx={{ 
            p: 1,
            bgcolor: 'rgba(255,152,0,0.1)',
            borderRadius: 1,
            border: '1px solid rgba(255,152,0,0.3)',
            minWidth: '150px'
          }}>
            <Typography variant="caption" sx={{ color: '#e65100', fontWeight: 700, fontSize: '0.65rem' }}>
              ⚡ {element.currentJob.jobTitle}
            </Typography>
            <Chip 
              label={element.currentJob.status}
              size="small"
              sx={{ 
                ml: 1, 
                height: '18px', 
                fontSize: '0.65rem',
                bgcolor: element.currentJob.status === 'pending' ? '#ffeb3b' : 
                        element.currentJob.status === 'in_progress' ? '#2196f3' : '#4caf50'
              }}
            />
          </Box>
        )}
      </Box>
      
      {/* Status Badge */}
      <Chip 
        label={element.status}
        size="small"
        sx={{ 
          bgcolor: statusColors.bg,
          color: statusColors.text,
          fontWeight: 600,
          textTransform: 'capitalize'
        }}
      />
      
      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          startIcon={<InfoIcon />}
          onClick={() => onMoreDetails(element)}
          sx={{ 
            minWidth: 'auto',
            px: 1,
            py: 0.5,
            fontSize: '0.75rem',
            textTransform: 'none'
          }}
        >
          Details
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<WorkIcon />}
          onClick={() => onManageJobs(element)}
          sx={{ 
            minWidth: 'auto',
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
            textTransform: 'none'
          }}
        >
          Jobs
        </Button>
      </Box>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return prevProps.element._id === nextProps.element._id &&
         prevProps.element.status === nextProps.element.status &&
         prevProps.element.currentJob?.status === nextProps.element.currentJob?.status;
});

ElementCard.displayName = 'ElementCard';

// Simplified field component
const Field = ({ label, value, minWidth, highlight }) => (
  <Box sx={{ minWidth }}>
    <Typography variant="caption" sx={{ color: '#666', fontSize: '0.65rem', display: 'block' }}>
      {label}
    </Typography>
    <Typography 
      variant="body2" 
      sx={{ 
        fontWeight: highlight ? 700 : 600,
        fontSize: '0.85rem',
        color: highlight ? '#1976d2' : '#000'
      }}
    >
      {value || '-'}
    </Typography>
  </Box>
);

export default ElementCard;
