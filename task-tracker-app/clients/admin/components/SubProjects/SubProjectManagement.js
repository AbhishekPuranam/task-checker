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
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <a href="/admin/projects" className="text-blue-600 hover:text-blue-800 hover:underline">
              Projects
            </a>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 font-medium">{project?.title || 'Loading...'}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Project Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{project?.title}</h1>
              <p className="text-gray-600 mb-1">{project?.description}</p>
              {project?.location && (
                <p className="text-sm text-gray-500">📍 {project.location}</p>
              )}
            </div>
          </div>
        
        {/* Project-level Statistics */}
        {projectStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border border-blue-200 shadow-sm">
              <div className="text-3xl font-bold text-blue-700 mb-1">{projectStats.totalElements || 0}</div>
              <div className="text-sm font-medium text-blue-600">Total Elements</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg border border-green-200 shadow-sm">
              <div className="text-3xl font-bold text-green-700 mb-1">{projectStats.completedElements || 0}</div>
              <div className="text-sm font-medium text-green-600">Completed</div>
              <div className="text-xs text-green-500 mt-1">
                {projectStats.totalElements > 0 ? Math.round((projectStats.completedElements / projectStats.totalElements) * 100) : 0}% complete
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border border-purple-200 shadow-sm">
              <div className="text-3xl font-bold text-purple-700 mb-1">{projectStats.totalSqm?.toFixed(2) || '0.00'}</div>
              <div className="text-sm font-medium text-purple-600">Total SQM</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-lg border border-orange-200 shadow-sm">
              <div className="text-3xl font-bold text-orange-700 mb-1">{projectStats.completedSqm?.toFixed(2) || '0.00'}</div>
              <div className="text-sm font-medium text-orange-600">Completed SQM</div>
              <div className="text-xs text-orange-500 mt-1">
                {projectStats.totalSqm > 0 ? Math.round((projectStats.completedSqm / projectStats.totalSqm) * 100) : 0}% complete
              </div>
            </div>
          </div>
        )}

        {/* Project-level Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => downloadReport(null)}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md"
          >
            📥 Download Full Project Report
          </button>
          <button
            onClick={() => downloadReport(null, 'active')}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
          >
            📊 Active Report
          </button>
          <button
            onClick={() => downloadReport(null, 'non clearance')}
            className="px-5 py-2.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors shadow-sm hover:shadow-md"
          >
            ⚠️ Non-Clearance Report
          </button>
          <button
            onClick={() => downloadReport(null, 'complete')}
            className="px-5 py-2.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm hover:shadow-md"
          >
            ✅ Complete Report
          </button>
        </div>
      </div>

      {/* SubProjects Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sub-Projects</h2>
            <p className="text-sm text-gray-500 mt-1">Organize your project into manageable sub-projects</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <span className="text-lg">+</span> Create Sub-Project
          </button>
        </div>

        {subProjects.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Sub-Projects Yet</h3>
            <p className="text-gray-500 mb-6">
              Create your first sub-project to start organizing your structural elements.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
            >
              + Create Your First Sub-Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subProjects.map((subProject) => (
              <div
                key={subProject._id}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer bg-white"
                onClick={() => navigateToSubProject(subProject._id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold text-gray-900">{subProject.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    subProject.status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' :
                    subProject.status === 'completed' ? 'bg-gray-100 text-gray-800 border border-gray-200' :
                    'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}>
                    {subProject.status.toUpperCase()}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-2xl font-bold text-gray-900">Create New Sub-Project</h3>
              <p className="text-sm text-gray-500 mt-1">Add a new sub-project to organize your structural elements</p>
            </div>
            
            <form onSubmit={handleCreateSubProject} className="px-6 py-5">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  required
                  value={newSubProject.name}
                  onChange={(e) => setNewSubProject({ ...newSubProject, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Building A - Floor 1"
                />
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Code *</label>
                <input
                  type="text"
                  required
                  value={newSubProject.code}
                  onChange={(e) => setNewSubProject({ ...newSubProject, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                  placeholder="e.g., BA-F1"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier for this sub-project</p>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newSubProject.description}
                  onChange={(e) => setNewSubProject({ ...newSubProject, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows="3"
                  placeholder="Optional description"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={newSubProject.status}
                  onChange={(e) => setNewSubProject({ ...newSubProject, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
                >
                  Create Sub-Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
