/**
 * Helper utility for formatting dates in DD/MM/YYYY format (e.g. 07/08/2026).
 */
export const formatDateToDMY = (dateInput?: string | number | Date): string => {
  if (!dateInput) return '';

  const str = String(dateInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Handle Indonesian legacy strings like "6 Agt 2026" or "06 Agt 2026"
  const indonesianMonths: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
    jul: '07', agt: '08', agu: '08', sep: '09', okt: '10', nov: '11', des: '12',
    januari: '01', februari: '02', maret: '03', april: '04', juni: '06',
    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
  };

  const matchIndo = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (matchIndo) {
    const day = matchIndo[1].padStart(2, '0');
    const monthStr = matchIndo[2].toLowerCase();
    const month = indonesianMonths[monthStr] || '01';
    const year = matchIndo[3];
    return `${day}/${month}/${year}`;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return str;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getTodayDateFormatted = (): string => {
  return formatDateToDMY(new Date());
};
