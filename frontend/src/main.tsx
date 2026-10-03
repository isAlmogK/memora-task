import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/inter';
import './index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { queryClient } from './app/queryClient';
import { preloadRoutes, router } from './app/router';
import { FlyProvider } from './components/FlyLayer';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <FlyProvider>
          <RouterProvider router={router} />
        </FlyProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);

preloadRoutes();
