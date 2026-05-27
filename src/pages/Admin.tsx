import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './Admin/Dashboard';

export function Admin() {
  return (
    <div className="flex-1">
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  );
}