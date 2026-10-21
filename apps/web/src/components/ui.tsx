import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: string }) {
  return <div className="page-title"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{children && <p>{children}</p>}</div></div>;
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="state">Loading data…</div>;
  if (error) return <div className="state error">{error}</div>;
  return null;
}

export function CardHead({ title, action, to }: { title: string; action?: string; to?: string }) {
  return <div className="card-head"><h2>{title}</h2>{action && to && <Link className="text-button" to={to}>{action} <ChevronRight size={14} aria-hidden="true"/></Link>}</div>;
}

export function Metric({ label, value, trend, tone = 'purple' }: { label: string; value: string; trend: string; tone?: string }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{trend}</small></div>;
}
