import { format as dateFnsFormat } from 'date-fns';

export interface Settings {
  language: string;
  region: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  measurementUnit: string;
}

export function formatDate(date: Date | string, settings: Settings): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Map our custom format to date-fns format
  const formatMap: Record<string, string> = {
    'dd/mm/yyyy': 'dd/MM/yyyy',
    'mm/dd/yyyy': 'MM/dd/yyyy',
    'yyyy-mm-dd': 'yyyy-MM-dd'
  };

  return dateFnsFormat(dateObj, formatMap[settings.dateFormat] || 'dd/MM/yyyy');
}

export function formatNumber(num: number, settings: Settings): string {
  const formatter = new Intl.NumberFormat(settings.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  });
  
  return formatter.format(num);
}

export function formatCurrency(amount: number, settings: Settings): string {
  const currencyMap: Record<string, string> = {
    'eur': 'EUR',
    'usd': 'USD',
    'gbp': 'GBP'
  };

  const formatter = new Intl.NumberFormat(settings.language, {
    style: 'currency',
    currency: currencyMap[settings.currency] || 'EUR'
  });

  return formatter.format(amount);
}

export function formatMeasurement(value: number, unit: string, settings: Settings): string {
  if (settings.measurementUnit === 'imperial') {
    // Convert metric to imperial
    switch (unit) {
      case 'm²':
        return `${(value * 10.764).toFixed(2)} sq ft`;
      case 'km':
        return `${(value * 0.621371).toFixed(2)} mi`;
      default:
        return `${value} ${unit}`;
    }
  }
  return `${value} ${unit}`;
}