import { Suspense } from 'react';
import { CreateClient } from './CreateClient';

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-page px-5 py-20 text-sm text-muted sm:px-8">
          正在加载创作流程…
        </div>
      }
    >
      <CreateClient />
    </Suspense>
  );
}
