import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AppEditor from './pages/AppEditor';
import AppViewer from './pages/AppViewer';
import AppNpsReport from './pages/AppNpsReport';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/apps" element={<Layout><Dashboard /></Layout>} />
          <Route path="/apps/:appId/edit" element={<AppEditor />} />
          <Route path="/apps/:appId/view" element={<AppViewer />} />
          <Route path="/apps/:appId/report" element={<AppNpsReport />} />
          <Route path="/apps/:appId/feedback" element={<AppViewer />} />
          <Route path="/apps/new" element={<Navigate to="/apps/new/edit" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
