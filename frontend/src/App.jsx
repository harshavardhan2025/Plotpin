import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PropertyProvider } from './contexts/PropertyContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';

export {
  calcDistanceKm,
  getPropertyLatLng,
  getFirstPropertyImageUrl,
  getPropertyTypeCategory,
  formatINR
} from './utils/propertyHelpers';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PropertyProvider>
            <AppRoutes />
          </PropertyProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
