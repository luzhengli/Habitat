import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: false }; }
    static getDerivedStateFromError() { return { error: true }; }
    render() { return this.state.error ? <main className="fatal"><h1>暂时无法打开工作空间</h1><p>重置演示不会影响真实文件。</p><button onClick={() => { try {
        localStorage.removeItem('habitat.prototype.air.v2');
    }
    catch { } location.reload(); }}>重置并重新打开</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
