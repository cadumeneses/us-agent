import { ChevronRight } from 'lucide-react';

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: string }) {
  return <div className="page-title"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{children && <p>{children}</p>}</div></div>;
}

export function LoadState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="state">Carregando dados…</div>;
  if (error) return <div className="state error">{error}</div>;
  return null;
}

export function CardHead({ title, action }: { title: string; action?: string }) {
  return <div className="card-head"><h2>{title}</h2>{action && <button className="text-button">{action} <ChevronRight size={14}/></button>}</div>;
}

export function Metric({ label, value, trend, tone = 'purple' }: { label: string; value: string; trend: string; tone?: string }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{trend}</small></div>;
}
