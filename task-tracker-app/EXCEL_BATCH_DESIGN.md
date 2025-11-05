# Excel Processing - Batch-Based Architecture

## Problem Statement

Current implementation uses all-or-nothing transactions:
- If 1 row fails out of 10,000 → entire upload rolls back
- No resume capability for failed uploads
- Memory intensive for large files
- Poor user experience for partial failures

## Proposed Solution: Batch Persistence with Resumability

### Core Principles

1. **Commit Per Batch**: Save batches independently to MongoDB
2. **Track Batch Status**: Store metadata about each batch's success/failure
3. **Resume from Failure**: Next upload skips successful batches
4. **Partial Success**: User gets successful data immediately
5. **Selective Cleanup**: Only delete failed batches, keep successful ones

---

## Architecture

### 1. Upload Session Model

```javascript
const UploadSessionSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileName: String,
  totalRows: Number,
  totalBatches: Number,
  
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'partial_success', 'failed'],
    default: 'in_progress'
  },
  
  batches: [{
    batchNumber: Number,
    startRow: Number,
    endRow: Number,
    status: { type: String, enum: ['pending', 'processing', 'success', 'failed'] },
    elementsCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StructuralElement' }],
    jobsCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    errorMessage: String,
    processedAt: Date,
    retryCount: { type: Number, default: 0 }
  }],
  
  summary: {
    successfulBatches: { type: Number, default: 0 },
    failedBatches: { type: Number, default: 0 },
    totalElementsCreated: { type: Number, default: 0 },
    totalJobsCreated: { type: Number, default: 0 },
    duplicatesSkipped: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});
```

### 2. Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Parse Excel & Create Upload Session                │
├─────────────────────────────────────────────────────────────┤
│ - Parse entire Excel file (read-only)                      │
│ - Create UploadSession with batch metadata                 │
│ - Divide into batches (e.g., 50 rows per batch)           │
│ - Mark all batches as 'pending'                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Process Each Batch Independently                   │
├─────────────────────────────────────────────────────────────┤
│ FOR EACH batch WHERE status = 'pending':                   │
│   1. Start MongoDB transaction (batch-scoped)              │
│   2. Transform & validate batch rows                       │
│   3. Check for duplicates                                  │
│   4. Create StructuralElements                             │
│   5. Create Jobs for each element                          │
│   6. COMMIT transaction                                    │
│   7. Update batch status to 'success'                      │
│   8. Store created element/job IDs in batch record        │
│                                                            │
│ IF batch fails:                                            │
│   - ROLLBACK transaction (only this batch)                │
│   - Mark batch as 'failed' with error message             │
│   - Continue to next batch (don't stop entire upload)     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Finalize Upload Session                            │
├─────────────────────────────────────────────────────────────┤
│ - Update session summary (success/failed counts)           │
│ - Mark session as 'completed' or 'partial_success'        │
│ - Invalidate cache ONCE (not per batch)                   │
│ - Send completion notification with summary               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Resume Failed Batches (Optional)                   │
├─────────────────────────────────────────────────────────────┤
│ User can retry failed batches:                             │
│ - Re-upload same file or provide uploadId                 │
│ - System detects existing session                         │
│ - Skips batches with status = 'success'                   │
│ - Only processes batches with status = 'failed'           │
│ - Updates session summary                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3. Cleanup Strategy

#### Smart Cleanup (NOT all-or-nothing)

```javascript
// Only cleanup failed batches
async function cleanupFailedBatches(uploadSessionId) {
  const session = await UploadSession.findById(uploadSessionId);
  
  for (const batch of session.batches) {
    if (batch.status === 'failed') {
      // Delete elements created in this failed batch
      await StructuralElement.deleteMany({
        _id: { $in: batch.elementsCreated }
      });
      
      // Delete jobs created in this failed batch
      await Job.deleteMany({
        _id: { $in: batch.jobsCreated }
      });
      
      // Mark batch as 'pending' for retry
      batch.status = 'pending';
      batch.elementsCreated = [];
      batch.jobsCreated = [];
      batch.errorMessage = null;
    }
    // Keep successful batches untouched
  }
  
  await session.save();
}
```

#### Full Cleanup (User-initiated)

```javascript
// Delete entire upload session and all created data
async function deleteUploadSession(uploadSessionId) {
  const session = await UploadSession.findById(uploadSessionId);
  
  // Collect all element IDs from all batches
  const allElementIds = session.batches.flatMap(b => b.elementsCreated);
  const allJobIds = session.batches.flatMap(b => b.jobsCreated);
  
  // Delete all elements and jobs
  await StructuralElement.deleteMany({ _id: { $in: allElementIds } });
  await Job.deleteMany({ _id: { $in: allJobIds } });
  
  // Delete the upload session
  await UploadSession.deleteOne({ _id: uploadSessionId });
}
```

---

## Benefits

### ✅ Resilience
- Batch 5 fails? Batches 1-4 data is safe
- No need to re-upload 10,000 rows for 1 error

### ✅ Resume Capability
- Failed upload? Resume from last successful batch
- System tracks exactly what was processed

### ✅ Better UX
- User sees partial results immediately
- Clear visibility: "5 batches succeeded, 2 failed"
- Option to retry only failed batches

### ✅ Memory Efficiency
- Process 50 rows at a time
- Free memory after each batch commit
- Can handle files with 100K+ rows

### ✅ Observability
- Detailed batch-level metrics
- Easy debugging: "Batch 7 failed at row 350"
- Historical upload tracking

### ✅ Selective Cleanup
- Only cleanup what failed
- Successful data remains intact
- User controls full vs partial cleanup

---

## Implementation Checklist

### Backend Changes

- [ ] Create `UploadSession` model
- [ ] Modify `excelProcessor.js` worker:
  - [ ] Create upload session before processing
  - [ ] Process in batch transactions
  - [ ] Update batch status after each commit
- [ ] Add retry endpoint: `POST /api/excel/retry/:uploadSessionId`
- [ ] Add cleanup endpoint: `DELETE /api/excel/session/:uploadSessionId`
- [ ] Add upload history endpoint: `GET /api/excel/sessions`

### Frontend Changes

- [ ] Show batch progress UI: "Batch 5/20 processing..."
- [ ] Display upload summary: "18 batches succeeded, 2 failed"
- [ ] Add retry button for failed uploads
- [ ] Show upload history table
- [ ] Add cleanup/delete options for upload sessions

### Database

- [ ] Create indexes on `UploadSession`:
  ```javascript
  uploadSessionSchema.index({ uploadId: 1 });
  uploadSessionSchema.index({ projectId: 1, status: 1 });
  uploadSessionSchema.index({ userId: 1, createdAt: -1 });
  ```

---

## Example User Flow

1. **Upload Excel with 10,000 rows**
   - System creates 200 batches (50 rows each)
   - Processes batches 1-150 successfully ✅
   - Batch 151 fails (validation error) ❌
   - Batches 152-200 process successfully ✅

2. **User sees result**:
   ```
   Upload Status: Partial Success
   - 199 batches successful
   - 1 batch failed (rows 7501-7550)
   - 9,950 elements created
   - 49,750 jobs created
   ```

3. **User options**:
   - **Retry failed batch**: Fix the 50 rows and re-upload
   - **Delete failed batch**: Keep 9,950 elements, discard the 50 failed rows
   - **Delete entire upload**: Start over completely

---

## Performance Comparison

### Current (All-or-Nothing)

| Rows | Memory | Time | Failure Impact |
|------|--------|------|----------------|
| 10,000 | ~500MB | 180s | Lose everything |
| 50,000 | ~2.5GB | 900s | Lose everything |

### Proposed (Batch-Based)

| Rows | Memory (Peak) | Time | Failure Impact |
|------|---------------|------|----------------|
| 10,000 | ~25MB | 190s | Lose 1 batch (50 rows) |
| 50,000 | ~25MB | 950s | Lose 1 batch (50 rows) |

---

## Migration Strategy

1. **Phase 1**: Implement `UploadSession` model (doesn't break existing code)
2. **Phase 2**: Add batch processing (new uploads use batches, old code still works)
3. **Phase 3**: Add retry/cleanup endpoints
4. **Phase 4**: Update frontend UI
5. **Phase 5**: Deprecate old all-or-nothing approach

---

## Conclusion

This batch-based design provides:
- **Fault tolerance**: Partial failures don't destroy all progress
- **Resumability**: Retry failed batches without re-uploading
- **Efficiency**: Lower memory footprint, better scalability
- **User control**: Choose what to keep/delete
- **Observability**: Clear tracking of what succeeded/failed

**Recommendation**: Implement this design for production use. The current all-or-nothing approach is risky for large datasets.
