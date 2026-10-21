import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
const AccessPage = lazy(() => import('./pages/AccessPage').then(module => ({ default: module.AccessPage })));
const ClassifyPage = lazy(() => import('./pages/ClassifyPage').then(module => ({ default: module.ClassifyPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(module => ({ default: module.ReviewPage })));
const StoriesPage = lazy(() => import('./pages/StoriesPage').then(module => ({ default: module.StoriesPage })));
const TaxonomyPage = lazy(() => import('./pages/TaxonomyPage').then(module => ({ default: module.TaxonomyPage })));
const RecommendersPage = lazy(() => import('./pages/RecommendersPage').then(module => ({ default: module.RecommendersPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(module => ({ default: module.ProjectsPage })));
const ProjectDetailsPage = lazy(() => import('./pages/ProjectDetailsPage').then(module => ({ default: module.ProjectDetailsPage })));
const ConfiguredRecommendationsPage = lazy(() => import('./pages/ConfiguredRecommendationsPage').then(module => ({ default: module.ConfiguredRecommendationsPage })));
const RecommenderSetupPage = lazy(() => import('./pages/RecommenderSetupPage').then(module => ({ default: module.RecommenderSetupPage })));
const NewRecommenderPage = lazy(() => import('./pages/NewRecommenderPage').then(module => ({ default: module.NewRecommenderPage })));

export default function App() {
  return <Routes><Route element={<AppLayout/>}><Route path="/" element={<Navigate to="/projects" replace/>}/><Route path="/projects" element={<ProjectsPage/>}/><Route path="/projects/:projectName" element={<ProjectDetailsPage/>}/><Route path="/classify" element={<ClassifyPage/>}/><Route path="/recommendations" element={<RecommendersPage/>}/><Route path="/recommenders/new" element={<NewRecommenderPage/>}/><Route path="/configured-recommendations" element={<ConfiguredRecommendationsPage/>}/><Route path="/recommender-setup" element={<RecommenderSetupPage/>}/><Route path="/review" element={<ReviewPage/>}/><Route path="/taxonomias" element={<Navigate to="/taxonomy" replace/>}/><Route path="/access" element={<AccessPage/>}/><Route path="/taxonomy" element={<TaxonomyPage/>}/><Route path="/runs" element={<StoriesPage/>}/><Route path="/dashboard" element={<DashboardPage/>}/><Route path="*" element={<Navigate to="/projects" replace/>}/></Route></Routes>;
}
