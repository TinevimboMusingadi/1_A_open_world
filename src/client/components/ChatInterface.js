import React, { useState, useRef, useEffect } from 'react';

/**
 * ChatInterface - Natural language input for game modifications
 */
function ChatInterface({ onSendMessage, connected, className = '' }) {
  const [message, setMessage] = useState('');
  const [messageHistory, setMessageHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const historyRef = useRef(null);

  // Example prompts to help users get started (shooter game focused)
  const examplePrompts = [
    "Add shooter controls to the player",
    "Create 5 more enemies to shoot",
    "Make bullets faster and more powerful",
    "Change enemy colors to green",
    "Add a rapid-fire mode",
    "Create moving enemy patrols",
    "Make enemies shoot back at player",
    "Add health system and damage"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || !connected) return;

    const newMessage = {
      id: Date.now(),
      text: message.trim(),
      timestamp: new Date(),
      type: 'user'
    };

    // Add to history
    setMessageHistory(prev => [...prev, newMessage]);
    
    // Send to parent
    onSendMessage(message.trim());
    
    // Clear input
    setMessage('');
    
    // Show typing indicator briefly
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 2000);
  };

  const handleExampleClick = (prompt) => {
    setMessage(prompt);
    inputRef.current?.focus();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messageHistory, isTyping]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Message History */}
      <div 
        ref={historyRef}
        className="flex-1 overflow-auto p-4 space-y-3"
      >
        {messageHistory.length === 0 ? (
          <div className="text-center text-muted py-8">
            <h3 className="font-semibold mb-3">💬 AI Game Modification Chat</h3>
            <p className="text-sm mb-4">
              Describe what you want to change in the game using natural language!
            </p>
            
            <div className="grid grid-cols-1 gap-2 max-w-md mx-auto">
              <p className="text-xs font-semibold text-secondary mb-2">Try these examples:</p>
              {examplePrompts.slice(0, 4).map((prompt, index) => (
                <button
                  key={index}
                  className="text-xs p-2 bg-panel hover:bg-panel-hover rounded border border-white border-opacity-10 transition"
                  onClick={() => handleExampleClick(prompt)}
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messageHistory.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-muted text-sm">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span>AI is processing your request...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white border-opacity-10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={connected ? "Describe what you want to change..." : "Connecting..."}
            className="input flex-1"
            disabled={!connected}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!message.trim() || !connected}
            className="btn btn-primary"
          >
            Send
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted">
            {message.length}/500 characters
          </div>
          
          {!connected && (
            <div className="text-xs text-error">
              ⚠️ Not connected to server
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }) {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-xs lg:max-w-md px-4 py-2 rounded-lg text-sm
        ${isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-panel border border-white border-opacity-10'
        }
      `}>
        <div className="break-words">
          {message.text}
        </div>
        <div className={`
          text-xs mt-1 opacity-75
          ${isUser ? 'text-blue-100' : 'text-muted'}
        `}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
}

export default ChatInterface; 