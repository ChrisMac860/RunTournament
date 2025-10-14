const form = document.getElementById('calcForm');
const output = document.getElementById('calcOut');

const COURSE_ID = 'CRAIGAVON';

const parseTimeToSeconds = (timeText) => {
  if (!/^\d{1,2}:\d{2}$/.test(timeText.trim())) {
    return null;
  }
  const [mm, ss] = timeText.split(':').map(Number);
  if (Number.isNaN(mm) || Number.isNaN(ss)) return null;
  return mm * 60 + ss;
};

const pdFromTime = (timeSeconds, course) => {
  // For Craigavon (CR=0), PD is simply pace vs 20:00 baseline
  const baselineSeconds = 20 * 60;
  const delta = timeSeconds - baselineSeconds;
  return Math.round((delta / 5) * 10) / 10;
};

const hiFromPDs = (pds) => {
  if (!Array.isArray(pds) || pds.length === 0) return 0;
  const sum = pds.reduce((acc, pd) => acc + pd, 0);
  return sum / pds.length;
};

const exceptionalCutIfAny = ({ pdToday, hiFrozen }) => {
  return pdToday < hiFrozen ? (hiFrozen - pdToday) * 0.1 : 0;
};

const round10 = (value) => {
  return Math.round(value / 10) * 10;
};

const applyCaps = ({ hiPrev, hiRaw, lowHI }) => {
  const minHi = lowHI != null ? Math.min(lowHI, hiPrev) : hiPrev;
  const capped = Math.max(0, Math.min(hiRaw, minHi + 30));
  return capped;
};

const renderResult = ({ pdToday, hiNew, hiPrev }) => {
  output.innerHTML = `
    <p>Today PD: <strong>${pdToday.toFixed(1)}</strong> sec/km</p>
    <p>New HI: <strong>${hiNew}</strong> sec/km (was ${hiPrev})</p>
    <p class="small">Assumes Craigavon (CR 0).</p>
  `;
};

const renderError = (message) => {
  output.innerHTML = `
    <p class="bad">${message}</p>
  `;
};

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const oldHiField = document.getElementById('oldHi');
  const lowHiField = document.getElementById('lowHi');
  const todayField = document.getElementById('today');
  const pdsField = document.getElementById('pds');

  const oldHi = Number(oldHiField.value);
  const lowHi = lowHiField.value ? Number(lowHiField.value) : oldHi;
  const todayTimeSeconds = parseTimeToSeconds(todayField.value);
  const pdList = (pdsField.value || '')
    .split(',')
    .map((pd) => pd.trim())
    .filter(Boolean)
    .map(Number)
    .filter((pd) => !Number.isNaN(pd));

  if (Number.isNaN(oldHi)) {
    renderError('Please enter a valid old HI (multiple of 10).');
    return;
  }

  if (todayTimeSeconds == null) {
    renderError('Enter today\'s time as mm:ss (e.g. 22:10).');
    return;
  }

  if (pdList.length > 0 && pdList.some((pd) => Number.isNaN(pd))) {
    renderError('Unable to parse one or more PD entries.');
    return;
  }

  const pdToday = pdFromTime(todayTimeSeconds, COURSE_ID);
  const hiRawBase = hiFromPDs([...pdList, pdToday]);
  const bonus = exceptionalCutIfAny({ pdToday, hiFrozen: oldHi });
  const hiRaw = round10(hiRawBase - bonus);
  const hiNew = applyCaps({ hiPrev: oldHi, hiRaw, lowHI: lowHi });

  renderResult({ pdToday, hiNew, hiPrev: oldHi });
});
