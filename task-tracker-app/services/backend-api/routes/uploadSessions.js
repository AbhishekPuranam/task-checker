const express = require('express');
const router = express.Router();
const UploadSession = require('../models/UploadSession');
const { auth } = require('../middleware/auth');
const {
  cleanupFailedBatches,
  deleteBatch,
  deleteUploadSession,
  retryFailedBatches,
  retryBatch
} = require('../utils/uploadSessionCleanup');
const { cleanupStalledUploads } = require('../workers/uploadCleanup');

/**
 * GET /api/upload-sessions
 * List upload sessions for a project
 */
router.get('/', auth, async (req, res) => {
  try {
    const { project, limit = 20 } = req.query;

    if (!project) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const sessions = await UploadSession.getRecentSessions(project, parseInt(limit));

    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching upload sessions:', error);
    res.status(500).json({ message: 'Error fetching upload sessions', error: error.message });
  }
});

/**
 * GET /api/upload-sessions/my
 * List user's upload sessions
 */
router.get('/my', auth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const sessions = await UploadSession.getUserSessions(req.user._id, parseInt(limit));

    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching user upload sessions:', error);
    res.status(500).json({ message: 'Error fetching upload sessions', error: error.message });
  }
});

/**
 * GET /api/upload-sessions/:uploadId
 * Get specific upload session details
 */
router.get('/:uploadId', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findByUploadId(uploadId)
      .populate('project', 'title')
      .populate('createdBy', 'name email');

    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching upload session:', error);
    res.status(500).json({ message: 'Error fetching upload session', error: error.message });
  }
});

/**
 * POST /api/upload-sessions/:uploadId/retry
 * Retry all failed batches in an upload session
 */
router.post('/:uploadId/retry', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findByUploadId(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    // Verify user has access to this session's project
    if (session.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to retry this upload session' });
    }

    const result = await retryFailedBatches(session._id);

    res.json({
      message: 'Failed batches marked for retry',
      ...result
    });
  } catch (error) {
    console.error('Error retrying upload session:', error);
    res.status(500).json({ message: 'Error retrying upload session', error: error.message });
  }
});

/**
 * POST /api/upload-sessions/:uploadId/batch/:batchNumber/retry
 * Retry a specific batch
 */
router.post('/:uploadId/batch/:batchNumber/retry', auth, async (req, res) => {
  try {
    const { uploadId, batchNumber } = req.params;

    const session = await UploadSession.findByUploadId(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    // Verify user has access
    if (session.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to retry this batch' });
    }

    const result = await retryBatch(session._id, parseInt(batchNumber));

    res.json({
      message: `Batch ${batchNumber} marked for retry`,
      ...result
    });
  } catch (error) {
    console.error('Error retrying batch:', error);
    res.status(500).json({ message: 'Error retrying batch', error: error.message });
  }
});

/**
 * DELETE /api/upload-sessions/:uploadId/failed-batches
 * Cleanup (delete data from) failed batches only
 */
router.delete('/:uploadId/failed-batches', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findByUploadId(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    // Verify user has access
    if (session.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to cleanup this upload session' });
    }

    const result = await cleanupFailedBatches(session._id);

    res.json({
      message: 'Failed batches cleaned up successfully',
      ...result
    });
  } catch (error) {
    console.error('Error cleaning up failed batches:', error);
    res.status(500).json({ message: 'Error cleaning up failed batches', error: error.message });
  }
});

/**
 * DELETE /api/upload-sessions/:uploadId/batch/:batchNumber
 * Delete a specific batch
 */
router.delete('/:uploadId/batch/:batchNumber', auth, async (req, res) => {
  try {
    const { uploadId, batchNumber } = req.params;

    const session = await UploadSession.findByUploadId(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    // Verify user has access
    if (session.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete this batch' });
    }

    const result = await deleteBatch(session._id, parseInt(batchNumber));

    res.json({
      message: `Batch ${batchNumber} deleted successfully`,
      ...result
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ message: 'Error deleting batch', error: error.message });
  }
});

/**
 * DELETE /api/upload-sessions/:uploadId
 * Delete entire upload session and all its data
 */
router.delete('/:uploadId', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findByUploadId(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    // Verify user has access
    if (session.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete this upload session' });
    }

    const result = await deleteUploadSession(session._id);

    res.json({
      message: 'Upload session deleted successfully',
      ...result
    });
  } catch (error) {
    console.error('Error deleting upload session:', error);
    res.status(500).json({ message: 'Error deleting upload session', error: error.message });
  }
});

/**
 * GET /api/upload-sessions/:uploadId/summary
 * Get upload session summary (lightweight)
 */
router.get('/:uploadId/summary', auth, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findByUploadId(uploadId)
      .select('uploadId status summary totalBatches fileName createdAt completedAt')
      .lean();

    if (!session) {
      return res.status(404).json({ message: 'Upload session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching upload session summary:', error);
    res.status(500).json({ message: 'Error fetching summary', error: error.message });
  }
});

/**
 * POST /api/upload-sessions/cleanup/stalled
 * Manually trigger cleanup of stalled upload sessions (admin only)
 */
router.post('/cleanup/stalled', auth, async (req, res) => {
  try {
    // Only admins can trigger manual cleanup
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const result = await cleanupStalledUploads();
    
    res.json({
      message: 'Stalled upload cleanup completed',
      ...result
    });
  } catch (error) {
    console.error('Error during stalled upload cleanup:', error);
    res.status(500).json({ message: 'Error cleaning up stalled uploads', error: error.message });
  }
});

module.exports = router;
