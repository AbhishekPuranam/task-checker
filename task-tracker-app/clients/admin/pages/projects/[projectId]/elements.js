import React from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Navbar from '../../../components/Navbar';
import StructuralElementsList from '../../../components/StructuralElements/StructuralElementsList';
import { useRouter } from 'next/router';

export default function ProjectElementsPage() {
  const router = useRouter();
  const { slug } = router.query;

  return (
    <ProtectedRoute adminOnly={true}>
      <Navbar />
      <StructuralElementsList projectSlug={slug} />
    </ProtectedRoute>
  );
}
