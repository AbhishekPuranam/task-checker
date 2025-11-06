import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const SECTIONS = [
  { id: 'active', label: 'Active', color: 'blue' },
  { id: 'non_clearance', label: 'Non-Clearance', color: 'yellow' },
  { id: 'no_job', label: 'No Job', color: 'gray' },
  { id: 'complete', label: 'Complete', color: 'green' }
];

export default function SubProjectDetail() {
  const router = useRouter();
  const { projectId, subProjectId } = router.query;

  const [subProject, setSubProject] = useState(null);
  const [activeSection, setActiveSection] = useState('active');
  const [groupBy, setGroupBy] = useState('');
  const [subGroupBy, setSubGroupBy] = useState('');
  const [groupedData, setGroupedData] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (subProjectId) {
      fetchSubProject();
      fetchAvailableFields();
    }
  }, [subProjectId]);

  useEffect(() => {
    if (groupBy && subProjectId) {
      fetchGroupedData();
    }
  }, [groupBy, subGroupBy, activeSection]);

  const fetchSubProject = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/subprojects/${subProjectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubProject(res.data);
    } catch (err) {
      console.error('Error fetching SubProject:', err);
      alert('Failed to load SubProject');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableFields = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/grouping/available-fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableFields(res.data.fields || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  const fetchGroupedData = async () => {
    try {
      setLoadingGroups(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/grouping/elements`,
        {
          subProjectId,
          status: activeSection,
          groupBy,
          subGroupBy: subGroupBy || undefined,
          page: 1,
          limit: 100
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setGroupedData(res.data);
    } catch (err) {
      console.error('Error fetching grouped data:', err);
      alert('Failed to load grouped data');
    } finally {
      setLoadingGroups(false);
    }
  };

  const downloadReport = async (status = null) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_URL}/reports/excel/subproject/${subProjectId}${status ? `?status=${status}` : ''}`;
      window.open(url + `&token=${token}`, '_blank');
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!subProject) {
    return <div className="text-red-600 p-4">SubProject not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{subProject.name}</h1>
            <div className="text-sm text-gray-600 mt-1">
              Code: <span className="font-mono font-bold">{subProject.code}</span>
            </div>
            {subProject.description && (
              <p className="text-gray-600 mt-2">{subProject.description}</p>
            )}
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ← Back to Project
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {subProject.statistics?.totalElements || 0}
            </div>
            <div className="text-sm text-gray-600">Total Elements</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-2xl font-bold text-green-600">
              {subProject.completionPercentage || 0}%
            </div>
            <div className="text-sm text-gray-600">Completion</div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {subProject.statistics?.totalSqm?.toFixed(2) || 0}
            </div>
            <div className="text-sm text-gray-600">Total SQM</div>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <div className="text-2xl font-bold text-orange-600">
              {subProject.sqmCompletionPercentage || 0}%
            </div>
            <div className="text-sm text-gray-600">SQM Completion</div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => downloadReport()}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export All
          </button>
          <button
            onClick={() => downloadReport(activeSection)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export {SECTIONS.find(s => s.id === activeSection)?.label}
          </button>
        </div>
      </div>

      {/* Sections Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          {SECTIONS.map((section) => {
            const count = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.count || 0;
            const sqm = subProject.statistics?.sections?.[section.id === 'non_clearance' ? 'nonClearance' : section.id === 'no_job' ? 'noJob' : section.id]?.sqm || 0;
            
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 px-6 py-4 text-center transition-colors ${
                  activeSection === section.id
                    ? `bg-${section.color}-100 border-b-2 border-${section.color}-600 font-semibold`
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="text-lg font-bold">{section.label}</div>
                <div className="text-sm text-gray-600">
                  {count} items • {sqm.toFixed(1)} SQM
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouping Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Group & Analyze</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Select Field --</option>
              {availableFields.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sub-Group By (Optional)</label>
            <select
              value={subGroupBy}
              onChange={(e) => setSubGroupBy(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              disabled={!groupBy}
            >
              <option value="">-- No Sub-Grouping --</option>
              {availableFields
                .filter((field) => field.value !== groupBy)
                .map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {groupBy && (
          <button
            onClick={fetchGroupedData}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loadingGroups}
          >
            {loadingGroups ? 'Loading...' : 'Apply Grouping'}
          </button>
        )}
      </div>

      {/* Grouped Results */}
      {groupedData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">
            Grouped Results ({groupedData.groups?.length || 0} groups)
          </h2>

          <div className="space-y-4">
            {groupedData.groups?.map((group, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {group._id[groupBy] || '(Not Set)'}
                      {subGroupBy && group._id[subGroupBy] && (
                        <span className="text-gray-600 ml-2">
                          → {group._id[subGroupBy]}
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {group.count} elements • {group.totalSqm?.toFixed(2)} SQM
                    </div>
                    {group.totalQty > 0 && (
                      <div className="text-sm text-gray-600">
                        Total Qty: {group.totalQty}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sample Elements */}
                {group.elements && group.elements.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Sample Elements (showing {Math.min(5, group.elements.length)} of {group.count}):
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Serial No</th>
                            <th className="px-3 py-2 text-left">Structure No</th>
                            <th className="px-3 py-2 text-left">Drawing No</th>
                            <th className="px-3 py-2 text-left">Level</th>
                            <th className="px-3 py-2 text-left">Section</th>
                            <th className="px-3 py-2 text-left">SQM</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.elements.slice(0, 5).map((element) => (
                            <tr key={element._id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{element.serialNo}</td>
                              <td className="px-3 py-2">{element.structureNumber}</td>
                              <td className="px-3 py-2">{element.drawingNo}</td>
                              <td className="px-3 py-2">{element.level}</td>
                              <td className="px-3 py-2">{element.sectionSizes}</td>
                              <td className="px-3 py-2">{element.surfaceAreaSqm?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
