// utils/format.ts
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 })
    .format(value) + " FCFA";
