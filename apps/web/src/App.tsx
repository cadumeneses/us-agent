import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ClassifyPage } from './pages/ClassifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewPage } from './pages/ReviewPage';
import { StoriesPage } from './pages/StoriesPage';
import { TaxonomyPage } from './pages/TaxonomyPage';
import { NfrRecommendationsPage } from './pages/NfrRecommendationsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';

export default function App() {
  return <Routes><Route element={<AppLayout/>}><Route path="/" element={<DashboardPage/>}/><Route path="/projects" element={<ProjectsPage/>}/><Route path="/projects/:projectName" element={<ProjectDetailsPage/>}/><Route path="/classify" element={<ClassifyPage/>}/><Route path="/recommendations" element={<NfrRecommendationsPage/>}/><Route path="/review" element={<ReviewPage/>}/><Route path="/taxonomy" element={<TaxonomyPage/>}/><Route path="/runs" element={<StoriesPage/>}/><Route path="*" element={<Navigate to="/projects" replace/>}/></Route></Routes>;
}
