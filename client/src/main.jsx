import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import AppProvider from './context/AppProvider'
import './index.css'
import { initialPage } from './seo/pageMetadata'

const bootstrap = initialPage();

const publicViews = {
  home: () => import('./student/pages/Home'),
  news: () => import('./student/pages/News'),
  article: () => import('./student/pages/NewsArticle'),
  study: () => import('./student/pages/PublicStudyPage'),
};
async function mount() {
  const initialView = bootstrap?.type && publicViews[bootstrap.type] ? (await publicViews[bootstrap.type]()).default : undefined;
  const application = (
  <StrictMode>
    <AppProvider initialData={bootstrap?.context}>
      <App initialData={bootstrap} initialView={initialView} />
    </AppProvider>
  </StrictMode>
  );
  const root = document.getElementById('root');
  if (initialView) hydrateRoot(root, application);
  else createRoot(root).render(application);
}
mount();
