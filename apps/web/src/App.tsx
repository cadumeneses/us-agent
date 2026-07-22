import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ClassifyPage } from './pages/ClassifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage, StoriesPage } from './pages/StoriesPage';
import { TaxonomyPage } from './pages/TaxonomyPage';

export default function App() {
  return <Routes><Route element={<AppLayout/>}><Route path="/" element={<DashboardPage/>}/><Route path="/classify" element={<ClassifyPage/>}/><Route path="/review" element={<ReviewPage/>}/><Route path="/taxonomy" element={<TaxonomyPage/>}/><Route path="/runs" element={<StoriesPage/>}/><Route path="*" element={<SettingsPage/>}/></Route></Routes>;
}
