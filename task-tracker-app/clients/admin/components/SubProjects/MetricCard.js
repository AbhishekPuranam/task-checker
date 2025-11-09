import { memo } from 'react';
import { Box, Typography } from '@mui/material';

// Memoized Metric Card - ArmorCode style
const MetricCard = memo(({ icon, label, value, color }) => (
  <Box sx={{ 
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    p: 1.5,
    bgcolor: '#fff',
    borderRadius: 1,
    border: `2px solid ${color}20`,
    minWidth: '140px',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 12px ${color}30`,
      borderColor: `${color}40`
    }
  }}>
    <Box sx={{ 
      fontSize: '2rem',
      lineHeight: 1
    }}>
      {icon}
    </Box>
    <Box>
      <Typography 
        variant="caption" 
        sx={{ 
          color: '#666',
          fontWeight: 600,
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'block',
          lineHeight: 1
        }}
      >
        {label}
      </Typography>
      <Typography 
        variant="h5" 
        sx={{ 
          color: color,
          fontWeight: 800,
          lineHeight: 1,
          mt: 0.5
        }}
      >
        {value}
      </Typography>
    </Box>
  </Box>
));

MetricCard.displayName = 'MetricCard';

export default MetricCard;
