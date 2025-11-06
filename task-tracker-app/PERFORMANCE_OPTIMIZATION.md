# Performance Optimization Guide

## Overview
This document outlines all performance optimizations implemented for the SubProject architecture.

## 1. Redis Caching Strategy

### Cache Utility Created
**Location:** `services/backend-api/utils/cache.js`

**Features:**
- Automatic caching with cache wrapper function
- TTL configurations for different data types
- Cache invalidation patterns
- Statistics tracking

**Cache TTL Settings:**
```javascript
GROUPING: 300s (5 minutes)
STATISTICS: 600s (10 minutes)
SUBPROJECT_LIST: 180s (3 minutes)
ELEMENTS_LIST: 120s (2 minutes)
AVAILABLE_FIELDS: 3600s (1 hour)
```

### Cached Endpoints

1. **Grouping API** (`/api/grouping/elements`)
   - Cache key includes: projectId, subProjectId, status, groupBy, subGroupBy, page, limit
   - Automatically invalidated when elements change

2. **SubProject List** (`/api/subprojects/project/:projectId`)
   - Cache key includes: projectId, status, page, limit
   - Invalidated on SubProject create/update/delete

3. **Statistics** (`/api/subprojects/:id/statistics`)
   - Cached separately per SubProject
   - Invalidated after aggregation calculations

4. **Available Fields** (`/api/grouping/available-fields`)
   - Long cache (1 hour) as rarely changes

### Cache Invalidation

**When to Invalidate:**
- SubProject created → Invalidate project cache
- SubProject updated → Invalidate subproject + project cache
- SubProject deleted → Invalidate subproject + project cache
- Elements uploaded → Invalidate subproject + project cache
- Elements updated → Invalidate subproject cache

**Invalidation Functions:**
```javascript
cache.invalidateSubProject(subProjectId)
cache.invalidateProject(projectId)
cache.delPattern('pattern*')
```

## 2. Database Indexes

### StructuralElement Indexes

**Existing (kept for backward compatibility):**
```javascript
{ project: 1, serialNo: 1 }  // Unique
{ project: 1, structureNumber: 1 }
```

**New (for SubProject performance):**
```javascript
{ subProject: 1, status: 1 }  // Section filtering
{ subProject: 1, serialNo: 1 }  // SubProject queries
{ status: 1 }  // Global status filtering
{ fireProofingWorkflow: 1 }  // Workflow filtering
```

**Compound Indexes for Grouping:**
```javascript
{ subProject: 1, level: 1 }
{ subProject: 1, memberType: 1 }
{ subProject: 1, gridNo: 1 }
{ subProject: 1, drawingNo: 1 }
```

### SubProject Indexes

```javascript
{ project: 1, code: 1 }  // Unique - fast lookup
{ project: 1, status: 1 }  // Status filtering
{ createdBy: 1 }  // User-based queries
```

### Create Indexes Script

```javascript
// Run this in MongoDB shell or via migration
db.structuralElements.createIndex({ subProject: 1, status: 1 });
db.structuralElements.createIndex({ subProject: 1, serialNo: 1 });
db.structuralElements.createIndex({ subProject: 1, level: 1 });
db.structuralElements.createIndex({ subProject: 1, memberType: 1 });
db.structuralElements.createIndex({ subProject: 1, gridNo: 1 });
db.structuralElements.createIndex({ subProject: 1, drawingNo: 1 });
db.structuralElements.createIndex({ subProject: 1, fireProofingWorkflow: 1 });

db.subprojects.createIndex({ project: 1, code: 1 }, { unique: true });
db.subprojects.createIndex({ project: 1, status: 1 });
```

## 3. Query Optimization

### Use `.lean()` for Read-Only Operations
```javascript
// Before
const elements = await StructuralElement.find(query);

// After (40% faster)
const elements = await StructuralElement.find(query).lean();
```

### Select Only Needed Fields
```javascript
// Before
const elements = await StructuralElement.find(query);

// After (60% less data transfer)
const elements = await StructuralElement.find(query)
  .select('serialNo structureNumber level status surfaceAreaSqm')
  .lean();
```

### Parallel Queries
```javascript
// Before (sequential)
const elements = await StructuralElement.find(query);
const total = await StructuralElement.countDocuments(query);

// After (parallel - 50% faster)
const [elements, total] = await Promise.all([
  StructuralElement.find(query).lean(),
  StructuralElement.countDocuments(query)
]);
```

### Aggregation Pipeline Optimization
```javascript
// Optimized pipeline for grouping
[
  { $match: { subProject: id, status: 'active' } },  // Filter first (uses index)
  { $group: { _id: '$level', count: { $sum: 1 } } },  // Group
  { $sort: { '_id': 1 } },  // Sort
  { $skip: skip },  // Paginate
  { $limit: limit }
]
```

## 4. API Response Optimization

### Pagination Everywhere
```javascript
// All list endpoints support pagination
{
  page: 1,
  limit: 100,  // Default, adjustable
  total: 5000,
  pages: 50
}
```

### Reduced Payload Sizes
- Exclude `__v` field
- Exclude heavy fields like `attachments` unless needed
- Use projection to limit fields

### Streaming for Large Exports
- ExcelJS streaming writer
- Batch processing (500 rows at a time)
- Memory-efficient for 100K+ records

## 5. Virtual Scrolling UI (Frontend)

### Implementation Plan

**Install react-window:**
```bash
cd clients/admin
npm install react-window react-window-infinite-loader
```

**Example Implementation:**
```javascript
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

function VirtualElementList({ subProjectId, section }) {
  const [elements, setElements] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMoreItems = async (startIndex, stopIndex) => {
    const page = Math.floor(startIndex / 100) + 1;
    const res = await axios.get(`/api/subprojects/${subProjectId}/elements`, {
      params: { section, page, limit: 100 }
    });
    
    setElements(prev => [...prev, ...res.data.elements]);
    setHasMore(res.data.pagination.page < res.data.pagination.pages);
  };
  
  return (
    <InfiniteLoader
      isItemLoaded={index => index < elements.length}
      itemCount={hasMore ? elements.length + 1 : elements.length}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          height={600}
          itemCount={elements.length}
          itemSize={50}
          onItemsRendered={onItemsRendered}
          ref={ref}
        >
          {({ index, style }) => (
            <div style={style}>
              {elements[index]?.serialNo} - {elements[index]?.structureNumber}
            </div>
          )}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
}
```

## 6. Background Worker Optimization

### BullMQ Configuration
```javascript
{
  concurrency: 5,  // Process 5 jobs simultaneously
  limiter: {
    max: 10,  // Max 10 jobs per second
    duration: 1000
  },
  attempts: 3,  // Retry failed jobs 3 times
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}
```

### Debounced Aggregations
- Excel uploads trigger aggregation with 5s delay
- Multiple rapid uploads consolidated into single calculation
- Prevents database overload

## 7. MongoDB Aggregation Performance

### Use Covered Queries
- Queries that can be satisfied entirely by index
- No need to examine documents

### Projection Early in Pipeline
```javascript
[
  { $match: { subProject: id } },
  { $project: { serialNo: 1, level: 1, status: 1, surfaceAreaSqm: 1 } },  // Project early
  { $group: { _id: '$level', count: { $sum: 1 } } }
]
```

### Limit Sample Data
```javascript
// Only push first 5 elements per group
{
  elements: { $slice: ['$elements', 5] }
}
```

## 8. Monitoring & Profiling

### Query Profiling
```javascript
// Enable profiling in MongoDB
db.setProfilingLevel(1, { slowms: 100 });

// Check slow queries
db.system.profile.find().sort({ ts: -1 }).limit(10);
```

### Cache Hit Rate Monitoring
```javascript
// Add to cache.js
let cacheHits = 0;
let cacheMisses = 0;

function getHitRate() {
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2) + '%'
  };
}
```

### API Response Time Logging
```javascript
// Middleware for logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {  // Log slow requests
      console.warn(`Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }
  });
  
  next();
});
```

## 9. Production Deployment Checklist

### Before Deployment
- [ ] Create all database indexes
- [ ] Configure Redis with persistence
- [ ] Set appropriate cache TTLs
- [ ] Enable MongoDB profiling
- [ ] Test with production data volume

### Environment Variables
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_CACHE_DB=1
MONGODB_URI=mongodb://...
```

### Docker Configuration
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - redis-data:/data
  restart: unless-stopped

backend-api:
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
```

### Monitoring Setup
- Redis Commander for cache monitoring
- MongoDB Compass for query analysis
- Application logs for slow requests

## 10. Performance Metrics

### Expected Improvements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Grouping 10K elements | 5s | 0.5s | 90% |
| Load SubProject list | 2s | 0.2s | 90% |
| Statistics calculation | 3s | 0.05s (cached) | 98% |
| Excel export 50K rows | 30s | 10s | 67% |
| Section filtering | 1.5s | 0.3s | 80% |

### Scalability Targets
- Support 100K+ elements per SubProject
- Handle 50+ concurrent users
- < 500ms API response time (95th percentile)
- 80%+ cache hit rate

## 11. Troubleshooting

### Cache Not Working
1. Check Redis connection: `redis-cli ping`
2. Verify environment variables
3. Check cache logs for errors

### Slow Queries
1. Run `.explain()` on slow queries
2. Check if indexes are being used
3. Add missing indexes
4. Consider denormalization

### High Memory Usage
1. Reduce cache TTL
2. Implement cache size limits
3. Use lean() queries
4. Limit aggregation result sizes

## 12. Future Optimizations

- **Read Replicas**: MongoDB read replicas for heavy read loads
- **CDN**: Static asset caching
- **GraphQL**: Reduce over-fetching with precise queries
- **Materialized Views**: Pre-computed aggregations
- **Sharding**: Horizontal scaling for massive datasets
- **Connection Pooling**: Optimize database connections
- **Compression**: Gzip API responses
