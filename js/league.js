const weekSelect = document.getElementById('weekSelect');
const weekLeaderboard = document.getElementById('weekLeaderboard');
const seasonTable = document.getElementById('seasonTable');
const dataError = document.getElementById('dataError');

const clearError = () => {
  dataError.style.display = 'none';
  dataError.textContent = '';
};

const showError = (message) => {
  dataError.style.display = 'block';
  dataError.textContent = message;
  weekLeaderboard.innerHTML = '';
  seasonTable.innerHTML = '';
};

const parseTimeToSeconds = (time) => {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const [minutes, seconds] = parts.map(Number);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return minutes * 60 + seconds;
};

const computeNetSecondsPerKm = (time, handicap) => {
  const totalSeconds = parseTimeToSeconds(time);
  if (totalSeconds == null) return null;
  const pace = totalSeconds / 5;
  return pace - handicap;
};

const formatNet = (net) => {
  if (net == null) return '—';
  const rounded = net.toFixed(1);
  const prefix = net > 0 ? '+' : '';
  return `${prefix}${rounded} sec/km`;
};

const pointsForPosition = (position) => Math.max(0, 10 - (position - 1) * 2);

const loadSeason = async () => {
  const response = await fetch('data/season.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load season.json (${response.status})`);
  }
  return response.json();
};

const computeSeason = (season) => {
  const players = Array.isArray(season.players) ? season.players : [];
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const weeks = (Array.isArray(season.weeks) ? season.weeks : []).map((week) => {
    const rows = (Array.isArray(week.results) ? week.results : []).map((result) => {
      const player = playerMap.get(result.playerId);
      const hiFrozen = player?.hi ?? 0;
      const net = computeNetSecondsPerKm(result.time, hiFrozen);
      return {
        playerId: result.playerId,
        runner: player?.name ?? 'Unknown runner',
        time: result.time,
        hiFrozen,
        net,
      };
    });

    const sortedRows = rows
      .map((row) => ({ ...row }))
      .sort((a, b) => {
        if (a.net == null && b.net == null) return 0;
        if (a.net == null) return 1;
        if (b.net == null) return -1;
        return a.net - b.net;
      });

    sortedRows.forEach((row, index) => {
      row.position = index + 1;
      row.points = pointsForPosition(row.position);
      row.netText = formatNet(row.net);
      row.hiDisplay = `${row.hiFrozen}s/km`;
    });

    return {
      id: String(week.week ?? index),
      weekNumber: week.week,
      date: week.date,
      rows: sortedRows,
    };
  });

  const totals = new Map(players.map((player) => [player.id, 0]));
  weeks.forEach((week) => {
    week.rows.forEach((row) => {
      if (!totals.has(row.playerId)) {
        totals.set(row.playerId, 0);
      }
      totals.set(row.playerId, (totals.get(row.playerId) ?? 0) + (row.points ?? 0));
    });
  });

  const standings = Array.from(totals.entries())
    .map(([playerId, points]) => {
      const player = playerMap.get(playerId) ?? { name: 'Unknown runner', hi: 0 };
      return {
        playerId,
        runner: player.name,
        points,
        hi: player.hi,
      };
    })
    .sort((a, b) => {
      if (b.points === a.points) {
        return a.runner.localeCompare(b.runner);
      }
      return b.points - a.points;
    })
    .map((entry, index) => ({
      position: index + 1,
      ...entry,
    }));

  return { weeks, standings };
};

const renderWeekOptions = (weeks) => {
  weekSelect.innerHTML = '';
  weeks.forEach((week) => {
    const option = document.createElement('option');
    option.value = week.id;
    const label = week.date ? `Week ${week.weekNumber} — ${week.date}` : `Week ${week.weekNumber ?? week.id}`;
    option.textContent = label;
    weekSelect.appendChild(option);
  });
  weekSelect.disabled = weeks.length === 0;
};

const renderWeekLeaderboard = (week) => {
  weekLeaderboard.innerHTML = '';
  if (!week || week.rows.length === 0) {
    weekLeaderboard.innerHTML = '<p class="small">No week results available yet.</p>';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = [
    { label: '#'},
    { label: 'Runner' },
    { label: 'Time' },
    { label: 'HI (frozen)', dataColumn: 'hi' },
    { label: 'NET' },
    { label: 'Pts' },
  ];

  headers.forEach(({ label, dataColumn }) => {
    const th = document.createElement('th');
    th.textContent = label;
    if (dataColumn) th.dataset.column = dataColumn;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  week.rows.forEach((row) => {
    const tr = document.createElement('tr');

    const cells = [
      { text: row.position },
      { text: row.runner },
      { text: row.time },
      { text: row.hiDisplay, dataColumn: 'hi' },
      { text: row.netText, className: row.net == null ? '' : row.net <= 0 ? 'good' : 'bad' },
      { text: row.points },
    ];

    cells.forEach(({ text, dataColumn, className }) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (dataColumn) td.dataset.column = dataColumn;
      if (className) td.classList.add(className);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  weekLeaderboard.appendChild(table);
};

const renderSeasonTable = (standings) => {
  seasonTable.innerHTML = '';
  if (!standings || standings.length === 0) {
    seasonTable.innerHTML = '<p class="small">No season standings yet.</p>';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = [
    { label: '#'},
    { label: 'Runner' },
    { label: 'Points' },
    { label: 'Current HI', dataColumn: 'hi' },
  ];

  headers.forEach(({ label, dataColumn }) => {
    const th = document.createElement('th');
    th.textContent = label;
    if (dataColumn) th.dataset.column = dataColumn;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  standings.forEach((entry) => {
    const tr = document.createElement('tr');
    const hiText = entry.hi != null ? `${entry.hi}s/km` : '—';

    const cells = [
      { text: entry.position },
      { text: entry.runner },
      { text: entry.points, className: 'points-strong' },
      { text: hiText, dataColumn: 'hi' },
    ];

    cells.forEach(({ text, dataColumn, className }) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (dataColumn) td.dataset.column = dataColumn;
      if (className) td.classList.add(className);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  seasonTable.appendChild(table);
};

const initialise = (computed) => {
  clearError();
  renderWeekOptions(computed.weeks);

  const weekMap = new Map(computed.weeks.map((week) => [week.id, week]));
  const defaultWeek = computed.weeks[computed.weeks.length - 1] ?? null;

  if (defaultWeek) {
    weekSelect.value = defaultWeek.id;
  }

  renderWeekLeaderboard(defaultWeek);
  renderSeasonTable(computed.standings);

  const handleWeekChange = () => {
    const selectedWeek = weekMap.get(weekSelect.value) ?? null;
    renderWeekLeaderboard(selectedWeek);
  };

  weekSelect.onchange = handleWeekChange;
};

(async () => {
  try {
    const season = await loadSeason();
    const computed = computeSeason(season);
    initialise(computed);
  } catch (error) {
    console.error('Failed to initialise league page', error);
    showError('Unable to load season data. Please try again later.');
  }
})();
