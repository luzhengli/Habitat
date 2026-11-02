import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { STORAGE_KEY } from './model';
import './tokens.css';
import './styles.css';
import './candidate.css';
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: false }; }
    static getDerivedStateFromError() { return { error: true }; }
    render() { return this.state.error ? <main className="fatal"><h1>暂时无法打开候选预览</h1><p>重置只清除浏览器中的合成候选状态。</p><button onClick={() => { try {
        localStorage.removeItem(STORAGE_KEY);
    }
    catch { } location.reload(); }}>重置并重新打开</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
