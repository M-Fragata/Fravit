import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Dashboard } from './components/dashboard/Dashboard';
import { EditorPreview } from './components/editor/EditorPreview';

export const App: React.FC = () => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  return (
    <AuthProvider>
      {activeProjectId ? (
        <EditorPreview
          projectId={activeProjectId}
          onBack={() => setActiveProjectId(null)}
        />
      ) : (
        <Dashboard onOpenProject={(id) => setActiveProjectId(id)} />
      )}
    </AuthProvider>
  );
};

export default App;
