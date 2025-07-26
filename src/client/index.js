import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

// Detect deployment environment
const isVercelDeployment = process.env.NODE_ENV === 'production' || 
                          (typeof window !== 'undefined' && 
                           (window.location.hostname.includes('vercel.app') || 
                            window.location.hostname.includes('vercel-project')));

// Dynamic import wrapper component
function AppLoader() {
  const [AppComponent, setAppComponent] = React.useState(null);
  
  React.useEffect(() => {
    async function loadApp() {
      try {
        let module;
        if (isVercelDeployment) {
          console.log('Loading Vercel-compatible App...');
          module = await import('./App.vercel.js');
        } else {
          console.log('Loading standard App with Socket.IO...');
          module = await import('./App.js');
        }
        setAppComponent(() => module.default);
      } catch (error) {
        console.error('Failed to load App component:', error);
        // Fallback to standard app
        const module = await import('./App.js');
        setAppComponent(() => module.default);
      }
    }
    
    loadApp();
  }, []);
  
  if (!AppComponent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <h2 className="text-lg font-semibold mb-2">Loading Game Engine</h2>
          <p className="text-muted">
            {isVercelDeployment ? 'Initializing API mode...' : 'Initializing Socket.IO mode...'}
          </p>
        </div>
      </div>
    );
  }
  
  return <AppComponent />;
}

// Error boundary for the entire app
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 100%)',
          color: '#ffffff',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#E74C3C' }}>
            🚨 Application Error
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '20px' }}>
            Something went wrong. Please refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#4A90E2',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Refresh Page
          </button>
          <details style={{ marginTop: '20px', fontSize: '12px', opacity: 0.6 }}>
            <summary style={{ cursor: 'pointer' }}>Error Details</summary>
            <pre style={{ marginTop: '10px', textAlign: 'left' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize React app
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppLoader />
    </ErrorBoundary>
  </React.StrictMode>
);

// Hot module replacement for development
if (module.hot) {
  module.hot.accept(['./App', './App.vercel'], () => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <AppLoader />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
} 