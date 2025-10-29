import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

const DefaultRedirect = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/projects', undefined, { replace: true });
  }, [router]);

  return <div>Redirecting...</div>;
};

export default DefaultRedirect;