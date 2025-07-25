import React from 'react';

function ConnectionStatus({ connected, reconnecting, error }) {
  if (reconnecting) {
    return (
      <div className="flex items-center gap-2 text-warning">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
        <span className="text-xs">Reconnecting...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-error" title={error}>
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="text-xs">Disconnected</span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-success">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-xs">Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-muted">
      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
      <span className="text-xs">Connecting...</span>
    </div>
  );
}

export default ConnectionStatus; 