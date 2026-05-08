"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 24px", textAlign: "center",
          background: "var(--surface)", borderRadius: "var(--r-lg)",
          border: "1px solid rgba(127,29,29,0.25)",
          margin: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: "var(--closed)" }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8, fontFamily: "'Poppins', serif" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20, maxWidth: 400 }}>
            {this.state.error?.message ?? "An unexpected error occurred. Please try refreshing the page."}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 20px", background: "var(--navy)", color: "#fff",
              border: "none", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Poppins', sans-serif",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode,
) {
  return function WrappedWithBoundary(props: T) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
