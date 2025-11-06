import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SubProjectManagement() {
  const router = useRouter();
  const { projectId } = router.query;

  const [subProjects, setSubProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubProject, setNewSubProject] = useState({
    name: '',
    code: '',
    description: '',
    status: 'active'
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [projectRes, subProjectsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/subprojects/project/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/subprojects/project/${projectId}/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setProject(projectRes.data);
      setSubProjects(subProjectsRes.data.subProjects || []);
      setProjectStats(statsRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubProject = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/subprojects`,
        {
          projectId,
          ...newSubProject
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setShowCreateModal(false);
      setNewSubProject({ name: '', code: '', description: '', status: 'active' });
      fetchData();
    } catch (err) {
      console.error('Error creating SubProject:', err);
      alert(err.response?.data?.error || 'Failed to create SubProject');
    }
  };

  const navigateToSubProject = (subProjectId) => {
    router.push(`/projects/${projectId}/subprojects/${subProjectId}`);
  };

  const navigateToExcelUpload = (subProjectId) => {
    router.push(`/projects/${projectId}/subprojects/${subProjectId}/upload`);
  };

  const downloadReport = async (subProjectId, status = null) => {
    try {
      const token = localStorage.getItem('token');
      const url = subProjectId
        ? `${API_URL}/reports/excel/subproject/${subProjectId}${status ? `?status=${status}` : ''}`
        : `${API_URL}/reports/excel/project/${projectId}${status ? `?status=${status}` : ''}`;

      window.open(url + `&token=${token}`, '_blank');
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600 p-4">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Project Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{project?.title}</h1>
        <p className="text-gray-600 mb-4">{project?.description}</p>
        
        {/* Project-level Statistics */}
        {projectStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">{projectStats.totalElements}</div>
              <div className="text-sm text-gray-600">Total Elements</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">{projectStats.completedElements}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-2xl font-bold text-purple-600">{projectStats.totalSqm?.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total SQM</div>
            </div>
            <div className="bg-orange-50 p-4 rounded">
              <div className="text-2xl font-bold text-orange-600">{projectStats.completedSqm?.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Completed SQM</div>
            </div>
          </div>
        )}

        {/* Project-level Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => downloadReport(null)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download Full Project Report
          </button>
          <button
            onClick={() => downloadReport(null, 'active')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Active Report
          </button>
          <button
            onClick={() => downloadReport(null, 'non clearance')}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Non-Clearance Report
          </button>
          <button
            onClick={() => downloadReport(null, 'complete')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Complete Report
          </button>
        </div>
      </div>

      {/* SubProjects Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Sub-Projects</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Sub-Project
          </button>
        </div>

        {subProjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No sub-projects yet. Create one to start organizing your structural elements.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subProjects.map((subProject) => (
              <div
                key={subProject._id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigateToSubProject(subProject._id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-semibold">{subProject.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${
                    subProject.status === 'active' ? 'bg-green-100 text-green-800' :
                    subProject.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {subProject.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  Code: <span className="font-mono font-bold">{subProject.code}</span>
                </div>

                {subProject.description && (
                  <p className="text-sm text-gray-600 mb-3">{subProject.description}</p>
                )}

                {/* SubProject Statistics */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {subProject.statistics?.totalElements || 0}
                    </div>
                    <div className="text-xs text-gray-600">Elements</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <div className="text-lg font-bold text-green-600">
                      {subProject.completionPercentage || 0}%
                    </div>
                    <div className="text-xs text-gray-600">Complete</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {subProject.statistics?.totalSqm?.toFixed(1) || 0}
                    </div>
                    <div className="text-xs text-gray-600">Total SQM</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {subProject.sqmCompletionPercentage || 0}%
                    </div>
                    <div className="text-xs text-gray-600">SQM Complete</div>
                  </div>
                </div>

                {/* Section Breakdown */}
                <div className="text-xs text-gray-600 mb-3">
                  <div>Active: {subProject.statistics?.sections?.active?.count || 0}</div>
                  <div>Non-Clearance: {subProject.statistics?.sections?.nonClearance?.count || 0}</div>
                  <div>No Job: {subProject.statistics?.sections?.noJob?.count || 0}</div>
                  <div>Complete: {subProject.statistics?.sections?.complete?.count || 0}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToExcelUpload(subProject._id);
                    }}
                    className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Upload Excel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadReport(subProject._id);
                    }}
                    className="flex-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create SubProject Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Sub-Project</h3>
            
            <form onSubmit={handleCreateSubProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={newSubProject.name}
                  onChange={(e) => setNewSubProject({ ...newSubProject, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Building A - Floor 1"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Code *</label>
                <input
                  type="text"
                  required
                  value={newSubProject.code}
                  onChange={(e) => setNewSubProject({ ...newSubProject, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded font-mono"
                  placeholder="e.g., BA-F1"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newSubProject.description}
                  onChange={(e) => setNewSubProject({ ...newSubProject, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows="3"
                  placeholder="Optional description"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={newSubProject.status}
                  onChange={(e) => setNewSubProject({ ...newSubProject, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
