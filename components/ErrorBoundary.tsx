'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="bg-red-50 rounded-[16px] p-5 border-2 border-red-200 flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-red-900 mb-1">Something went wrong</h3>
                            <p className="text-red-700 text-sm">{this.state.error?.message || 'An unexpected error occurred'}</p>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null })}
                                className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}
