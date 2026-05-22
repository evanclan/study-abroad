import { Badge } from '@/components/ui/badge';
import { ColumnShell } from '@/components/ui/column-shell';
import { MetricCard } from '@/components/ui/metric-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatJpy,
  formatSourceCurrency,
} from '@/lib/utils/format-currency';
import type { QuoteCosts } from '@/types/quote';
import {
  Building2,
  FileSignature,
  GraduationCap,
  Heart,
  Plane,
  PiggyBank,
  StampIcon,
  Wallet,
} from 'lucide-react';

interface FinancialBlueprintProps {
  costs: QuoteCosts | null;
}

interface SchoolField {
  key: 'tuition' | 'accommodation' | 'registration' | 'otherFees';
  label: string;
  icon: React.ReactNode;
}

interface ExtraField {
  key: 'flights' | 'insurance' | 'visa' | 'livingExpenses';
  label: string;
  icon: React.ReactNode;
}

const SCHOOL_FIELDS: SchoolField[] = [
  { key: 'tuition', label: '授業料', icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { key: 'accommodation', label: '滞在費', icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: 'registration', label: '入学金', icon: <FileSignature className="h-3.5 w-3.5" /> },
  { key: 'otherFees', label: 'その他', icon: <PiggyBank className="h-3.5 w-3.5" /> },
];

const EXTRA_FIELDS: ExtraField[] = [
  { key: 'flights', label: '航空券', icon: <Plane className="h-3.5 w-3.5" /> },
  { key: 'insurance', label: '海外保険', icon: <Heart className="h-3.5 w-3.5" /> },
  { key: 'visa', label: 'ビザ', icon: <StampIcon className="h-3.5 w-3.5" /> },
  { key: 'livingExpenses', label: '生活費', icon: <Wallet className="h-3.5 w-3.5" /> },
];

export function FinancialBlueprint({ costs }: FinancialBlueprintProps) {
  return (
    <ColumnShell
      title="Financial Blueprint"
      subtitle="費用内訳（学校＋付帯費）"
      index={2}
      accent="amber"
      trailing={<Badge variant="warn">手数料を除く</Badge>}
    >
      {!costs ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
          <Skeleton className="h-[100px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
            学校への支払い
          </div>
          <div className="flex flex-col gap-2">
            {SCHOOL_FIELDS.map((field) => {
              const amountSource = costs[field.key];
              const amountJpy = amountSource * costs.fxRate;
              return (
                <MetricCard
                  key={field.key}
                  label={field.label}
                  icon={field.icon}
                  primary={formatJpy(amountJpy)}
                  secondary={
                    amountSource > 0
                      ? formatSourceCurrency(amountSource, costs.currencyCode)
                      : '—'
                  }
                />
              );
            })}
          </div>

          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            付帯費用（概算）
          </div>
          <div className="flex flex-col gap-2">
            {EXTRA_FIELDS.map((field) => {
              const amountJpy = costs[field.key];
              return (
                <MetricCard
                  key={field.key}
                  label={field.label}
                  icon={field.icon}
                  primary={formatJpy(amountJpy)}
                  secondary="エージェント概算"
                />
              );
            })}
          </div>

          <MetricCard
            label="合計 (日本円)"
            emphasis="total"
            primary={formatJpy(costs.totalJpy)}
            secondary={`学校 ${formatSourceCurrency(costs.total, costs.currencyCode)} · 1 ${costs.currencyCode} = ¥${costs.fxRate.toFixed(2)}`}
            hint="エージェント手数料は含みません"
          />
        </div>
      )}
    </ColumnShell>
  );
}
