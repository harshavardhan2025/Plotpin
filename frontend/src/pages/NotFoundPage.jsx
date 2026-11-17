import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-4xl font-black text-emerald-800">404</div>
        <h2 className="text-lg font-bold text-slate-900">Page Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested page or property listing does not exist or has been moved.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/explore"
            className="px-4 py-2 bg-[#184631] text-white rounded-xl text-xs font-bold hover:bg-[#123625] transition-all inline-flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            <span>Go to Explore</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

