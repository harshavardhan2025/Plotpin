import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="p-2 bg-rose-500/20 rounded-xl text-xl font-bold">⚠️</span>
              <div>
                <h2 className="text-lg font-black">Something went wrong in the Admin Console</h2>
                <p className="text-xs text-slate-400">An unexpected runtime exception was caught safely.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl text-xs font-mono text-rose-300 overflow-x-auto border border-rose-950 max-h-48">
              {this.state.error?.toString()}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('plotpin_admin_calls');
                    localStorage.removeItem('landpin_admin_calls');
                    localStorage.removeItem('plotpin_admin_bookings');
                    localStorage.removeItem('landpin_admin_bookings');
                    localStorage.removeItem('plotpin_status_overrides');
                    localStorage.removeItem('landpin_status_overrides');
                    localStorage.removeItem('plotpin_property_edits');
                    localStorage.removeItem('landpin_property_edits');
                  } catch (e) {}
                  window.location.reload();
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Reset &amp; Reload Console
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
