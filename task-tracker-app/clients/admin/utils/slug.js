/**
 * Convert a project title to a URL-friendly slug
 * @param {string} title - The project title
 * @returns {string} - URL-friendly slug
 */
export function titleToSlug(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    // Replace spaces and special characters with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove any characters that aren't alphanumeric or hyphens
    .replace(/[^\w\-]+/g, '')
    // Replace multiple consecutive hyphens with a single one
    .replace(/\-\-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a slug back to a title (for display purposes)
 * @param {string} slug - The URL slug
 * @returns {string} - Human-readable title
 */
export function slugToTitle(slug) {
  if (!slug) return '';
  
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get project URL with slug (fallback to ID if title not available)
 * @param {object} project - Project object with _id and title
 * @returns {string} - URL path
 */
export function getProjectUrl(project) {
  if (!project) return '';
  
  if (project.title) {
    const slug = titleToSlug(project.title);
    return `/projects/${slug}`;
  }
  
  // Fallback to ID if no title
  return `/projects/${project._id}`;
}
