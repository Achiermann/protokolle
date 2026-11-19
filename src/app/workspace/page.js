import { Suspense } from 'react';
import WorkspaceSelector from '../components/WorkspaceSelector';

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceSelector />
    </Suspense>
  );
}
