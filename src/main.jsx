import React from 'react';
import { createRoot } from 'react-dom/client';
import ReviewSurvey from './ReviewSurvey.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReviewSurvey />
  </React.StrictMode>
);
