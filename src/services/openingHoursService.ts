interface OpeningHours {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

interface TimeCheck {
  isOpen: boolean;
  message?: string;
  closingTime?: string;
}

const DAYS_MAP: { [key: number]: keyof OpeningHours } = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  const match = timeStr.match(/(\d+)h(\d+)/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }
  return null;
}

function parseTimeRange(rangeStr: string): { start: Date; end: Date }[] | null {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return null;
  }

  const lowerRange = rangeStr.toLowerCase();
  if (lowerRange.includes('fechado') || lowerRange.includes('fermé') || lowerRange.includes('closed')) {
    return null;
  }

  const ranges: { start: Date; end: Date }[] = [];
  const now = new Date();

  try {
    const periods = rangeStr.split('/').map(s => s.trim());

    for (const period of periods) {
      if (!period) continue;

      const parts = period.split('-').map(s => s.trim());
      if (parts.length !== 2) {
        continue;
      }

      const startTime = parseTime(parts[0]);
      const endTime = parseTime(parts[1]);

      if (!startTime || !endTime) {
        continue;
      }

      const start = new Date(now);
      start.setHours(startTime.hours, startTime.minutes, 0, 0);

      const end = new Date(now);
      end.setHours(endTime.hours, endTime.minutes, 0, 0);

      ranges.push({ start, end });
    }
  } catch (error) {
    console.error('Error parsing time range:', error);
    return null;
  }

  return ranges.length > 0 ? ranges : null;
}

export function checkOpeningHours(openingHours: OpeningHours, closingBufferMinutes: number = 30): TimeCheck {
  if (!openingHours) {
    return {
      isOpen: false,
      message: 'Horários não configurados.'
    };
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayKey = DAYS_MAP[dayOfWeek];

  const todayHours = openingHours[dayKey];

  if (!todayHours || typeof todayHours !== 'string') {
    return {
      isOpen: false,
      message: 'O restaurante está fechado hoje.'
    };
  }

  if (todayHours.toLowerCase().includes('fechado') || todayHours.toLowerCase().includes('fermé')) {
    return {
      isOpen: false,
      message: 'O restaurante está fechado hoje.'
    };
  }

  const timeRanges = parseTimeRange(todayHours);

  if (!timeRanges || timeRanges.length === 0) {
    return {
      isOpen: false,
      message: 'Horário de abertura não disponível.'
    };
  }

  let isInBreak = false;
  let nextOpeningTime: string | null = null;

  for (const { start, end } of timeRanges) {
    const closingBuffer = new Date(end);
    closingBuffer.setMinutes(closingBuffer.getMinutes() - closingBufferMinutes);

    if (now >= start && now < closingBuffer) {
      return {
        isOpen: true
      };
    }

    if (now >= closingBuffer && now <= end) {
      const closingTime = `${end.getHours()}h${end.getMinutes().toString().padStart(2, '0')}`;
      return {
        isOpen: false,
        message: `O restaurante fecha às ${closingTime}. Não aceitamos pedidos nos últimos ${closingBufferMinutes} minutos antes do fecho.`,
        closingTime
      };
    }

    if (now < start) {
      nextOpeningTime = `${start.getHours()}h${start.getMinutes().toString().padStart(2, '0')}`;
      break;
    }

    if (now > end && !nextOpeningTime) {
      isInBreak = true;
    }
  }

  if (nextOpeningTime) {
    return {
      isOpen: false,
      message: `O restaurante abre às ${nextOpeningTime}.`
    };
  }

  if (isInBreak && timeRanges.length > 1) {
    for (const { start } of timeRanges) {
      if (now < start) {
        const openingTime = `${start.getHours()}h${start.getMinutes().toString().padStart(2, '0')}`;
        return {
          isOpen: false,
          message: `O restaurante reabre às ${openingTime}.`
        };
      }
    }
  }

  const lastRange = timeRanges[timeRanges.length - 1];
  const closingTime = `${lastRange.end.getHours()}h${lastRange.end.getMinutes().toString().padStart(2, '0')}`;
  return {
    isOpen: false,
    message: `O restaurante fechou às ${closingTime}.`
  };
}

export function getNextOpeningTime(openingHours: OpeningHours): string | null {
  const now = new Date();
  const dayOfWeek = now.getDay();

  for (let i = 1; i <= 7; i++) {
    const checkDay = (dayOfWeek + i) % 7;
    const dayKey = DAYS_MAP[checkDay];
    const dayHours = openingHours[dayKey];

    if (!dayHours || typeof dayHours !== 'string') {
      continue;
    }

    if (dayHours.toLowerCase().includes('fechado') || dayHours.toLowerCase().includes('fermé')) {
      continue;
    }

    const timeRanges = parseTimeRange(dayHours);
    if (timeRanges && timeRanges.length > 0) {
      const dayNames: { [key: number]: string } = {
        0: 'domingo',
        1: 'segunda-feira',
        2: 'terça-feira',
        3: 'quarta-feira',
        4: 'quinta-feira',
        5: 'sexta-feira',
        6: 'sábado'
      };

      const firstRange = timeRanges[0];
      const openingTime = `${firstRange.start.getHours()}h${firstRange.start.getMinutes().toString().padStart(2, '0')}`;
      return `${dayNames[checkDay]} às ${openingTime}`;
    }
  }

  return null;
}
