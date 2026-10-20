import { AccessPage } from './pages/AccessPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ClassifyPage } from './pages/ClassifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewPage } from './pages/ReviewPage';
import { StoriesPage } from './pages/StoriesPage';
import { TaxonomyPage } from './pages/TaxonomyPage';
import { RecommendersPage } from './pages/RecommendersPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';
import { ConfiguredRecommendationsPage } from './pages/ConfiguredRecommendationsPage';
import { RecommenderSetupPage } from './pages/RecommenderSetupPage';

export default function App() {
  return <Routes><Route element={<AppLayout/>}><Route path="/" element={<Navigate to="/projects" replace/>}/><Route path="/projects" element={<ProjectsPage/>}/><Route path="/projects/:projectName" element={<ProjectDetailsPage/>}/><Route path="/classify" element={<ClassifyPage/>}/><Route path="/recommendations" element={<RecommendersPage/>}/><Route path="/configured-recommendations" element={<ConfiguredRecommendationsPage/>}/><Route path="/recommender-setup" element={<RecommenderSetupPage/>}/><Route path="/review" element={<ReviewPage/>}/><Route path="/taxonomias" element={<Navigate to="/taxonomy" replace/>}/><Route path="/access" element={<AccessPage/>}/><Route path="/taxonomy" element={<TaxonomyPage/>}/><Route path="/runs" element={<StoriesPage/>}/><Route path="/dashboard" element={<DashboardPage/>}/><Route path="*" element={<Navigate to="/projects" replace/>}/></Route></Routes>;
}
