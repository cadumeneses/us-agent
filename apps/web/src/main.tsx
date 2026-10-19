import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WebAccessGate } from './components/WebAccessGate';
import './styles.css';
import './private-access.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><WebAccessGate><App /></WebAccessGate></BrowserRouter></React.StrictMode>);
