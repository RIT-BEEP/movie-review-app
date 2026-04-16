let chartInstance = null;
let trendChartInstance = null;

// ── ADD REVIEW + AUTO ANALYZE ──────────────────────────────────
async function addReview() {
  const movie  = document.getElementById('formMovie').value.trim();
  const review = document.getElementById('formReview').value.trim();
  const rating = document.getElementById('formRating').value;

  const successEl = document.getElementById('addSuccess');
  const errorEl   = document.getElementById('addError');
  successEl.style.display = 'none';
  errorEl.style.display   = 'none';

  if (!movie || !review) {
    errorEl.textContent   = 'Movie name aur review dono bharo!';
    errorEl.style.display = 'block';
    return;
  }

  const btn = document.querySelector('.add-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving...';

  try {
    // Step 1: Save review
    const res = await fetch('http://127.0.0.1:5000/add_review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movie, review, rating })
    });

    const data = await res.json();
    btn.disabled    = false;
    btn.textContent = '+ ADD REVIEW';

    if (!res.ok || data.error) {
      errorEl.textContent   = data.error || 'Kuch galat hua.';
      errorEl.style.display = 'block';
      return;
    }

    successEl.textContent   = `✓ Review save ho gaya! Sentiment: ${data.sentiment} — Analyzing...`;
    successEl.style.display = 'block';

    // Clear form
    document.getElementById('formMovie').value  = '';
    document.getElementById('formReview').value = '';
    document.getElementById('formRating').value = '3';
    document.getElementById('sentimentPreview').textContent = '';
    document.getElementById('sentimentPreview').className  = 'sentiment-preview';

    // Step 2: Auto analyze immediately
    await analyzeMovie(movie);

  } catch (e) {
    btn.disabled    = false;
    btn.textContent = '+ ADD REVIEW';
    errorEl.textContent   = 'Backend se connect nahi ho pa raha. Flask chal raha hai?';
    errorEl.style.display = 'block';
  }
}

// ── ANALYZE FROM SEARCH BOX ────────────────────────────────────
async function analyze() {
  const movie = document.getElementById('movieInput').value.trim();
  if (!movie) return;
  await analyzeMovie(movie);
}

// ── CORE ANALYZE FUNCTION ──────────────────────────────────────
async function analyzeMovie(movie) {
  document.getElementById('results').style.display        = 'none';
  document.getElementById('overviewSection').style.display = 'none';
  document.getElementById('errorMsg').style.display       = 'none';
  document.getElementById('loadingBar').style.display     = 'block';

  // Put movie name in search box too
  document.getElementById('movieInput').value = movie;

  try {
    const res = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movie })
    });

    const data = await res.json();
    document.getElementById('loadingBar').style.display = 'none';

    if (!res.ok || data.error) {
      showError(data.error || 'Kuch galat hua.');
      return;
    }

    renderResults(data);

  } catch (e) {
    document.getElementById('loadingBar').style.display = 'none';
    showError('Backend se connect nahi ho pa raha. Flask chal raha hai?');
  }
}

// ── SHOW ERROR ─────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent   = msg;
  el.style.display = 'block';
}

// ── RENDER RESULTS ─────────────────────────────────────────────
function renderResults(data) {
  const emoji = data.verdict === 'WATCH' ? '🎬' : data.verdict === 'SKIP' ? '⛔' : '🤔';

  // Poster or emoji
  const posterEl = document.getElementById('verdictEmoji');
  if (data.poster && data.poster !== 'N/A') {
    posterEl.innerHTML = `<img src="${data.poster}"
      style="width:80px;height:110px;object-fit:cover;border-radius:8px;" />`;
  } else {
    posterEl.textContent = emoji;
  }

  // Title + badge
  document.getElementById('movieTitle').textContent = data.movie;
  const badge = document.getElementById('verdictBadge');
  badge.textContent = `${emoji} ${data.verdict}`;
  badge.className   = `verdict-badge verdict-${data.verdict}`;
  document.getElementById('verdictReason').textContent = data.verdict_reason || '';

  // Meta tags
  let metaHtml = '';
  if (data.year)     metaHtml += `<span class="meta-tag">${data.year}</span>`;
  if (data.genre)    metaHtml += `<span class="meta-tag">${data.genre}</span>`;
  if (data.director) metaHtml += `<span class="meta-tag">Dir: ${data.director}</span>`;
  if (data.runtime)  metaHtml += `<span class="meta-tag">${data.runtime}</span>`;
  const metaEl = document.getElementById('movieMeta');
  if (metaEl) metaEl.innerHTML = metaHtml;

  // Plot
  const plotSection = document.getElementById('plotSection');
  const plotEl      = document.getElementById('moviePlot');
  if (data.plot && data.plot !== 'N/A' && plotSection && plotEl) {
    plotEl.textContent        = data.plot;
    plotSection.style.display = 'block';
  } else if (plotSection) {
    plotSection.style.display = 'none';
  }

  // Actors
  const actorsSection = document.getElementById('actorsSection');
  const actorsEl      = document.getElementById('movieActors');
  if (data.actors && data.actors !== 'N/A' && actorsSection && actorsEl) {
    actorsEl.textContent        = '🎭 ' + data.actors;
    actorsSection.style.display = 'block';
  } else if (actorsSection) {
    actorsSection.style.display = 'none';
  }

  // Awards
  const awardsSection = document.getElementById('awardsSection');
  const awardsEl      = document.getElementById('movieAwards');
  if (data.awards && data.awards !== 'N/A' && data.awards !== 'N/A.'
      && awardsSection && awardsEl) {
    awardsEl.textContent        = '🏆 ' + data.awards;
    awardsSection.style.display = 'block';
  } else if (awardsSection) {
    awardsSection.style.display = 'none';
  }

  // Stat cards
  document.getElementById('ratingVal').textContent =
    data.total_reviews > 0 ? data.rating + '/5' : 'N/A';
  document.getElementById('posVal').textContent   = data.positive_pct + '%';
  document.getElementById('negVal').textContent   = data.negative_pct + '%';
  document.getElementById('totalVal').textContent = data.total_reviews;

  // IMDb
  const imdbCard = document.getElementById('imdbCard');
  const imdbVal  = document.getElementById('imdbVal');
  if (data.imdb_rating && imdbCard && imdbVal) {
    imdbVal.textContent     = data.imdb_rating + '/10';
    imdbCard.style.display  = 'block';
  } else if (imdbCard) {
    imdbCard.style.display  = 'none';
  }

  // Rotten Tomatoes
  const rtCard = document.getElementById('rtCard');
  const rtVal  = document.getElementById('rtVal');
  if (data.rt_rating && rtCard && rtVal) {
    rtVal.textContent    = data.rt_rating;
    rtCard.style.display = 'block';
  } else if (rtCard) {
    rtCard.style.display = 'none';
  }

  // Sentiment bars (animated)
  setTimeout(() => {
    document.getElementById('barPos').style.width = data.positive_pct + '%';
    document.getElementById('barNeg').style.width = data.negative_pct + '%';
    document.getElementById('barNeu').style.width = data.neutral_pct  + '%';
  }, 100);

  document.getElementById('pPct').textContent  = data.positive_pct + '%';
  document.getElementById('nPct').textContent  = data.negative_pct + '%';
  document.getElementById('nuPct').textContent = data.neutral_pct  + '%';

  // Mini stats
  document.getElementById('loveVal').textContent    = data.love_pct + '%';
  document.getElementById('hypeVal').textContent    = data.hype_pct + '%';
  document.getElementById('rewatchVal').textContent = data.rewatch_value || 'N/A';

  // Charts
  loadChart(data);

  // Show everything
  document.getElementById('results').style.display        = 'block';
  document.getElementById('overviewSection').style.display = 'block';
  loadTrendChart(data);

  // Scroll to results smoothly
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

// ── DOUGHNUT CHART ─────────────────────────────────────────────
function loadChart(data) {
  if (chartInstance) { chartInstance.destroy(); }
  const ctx = document.getElementById('chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        data: [data.positive_pct, data.negative_pct, data.neutral_pct],
        backgroundColor: ['#4CAF5088', '#E0525288', '#5B9BD588'],
        borderColor:     ['#4CAF50',   '#E05252',   '#5B9BD5'],
        borderWidth: 1.5,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          labels: {
            color: '#888',
            font: { size: 12, family: 'DM Sans' },
            padding: 16
          }
        }
      }
    }
  });
}

// ── BAR TREND CHART ────────────────────────────────────────────
function loadTrendChart(data) {
  if (trendChartInstance) { trendChartInstance.destroy(); }
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        label: 'Opinion Distribution (%)',
        data: [data.positive_pct, data.negative_pct, data.neutral_pct],
        backgroundColor: ['#4CAF5066', '#E0525266', '#5B9BD566'],
        borderColor:     ['#4CAF50',   '#E05252',   '#5B9BD5'],
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#888', font: { size: 12, family: 'DM Sans' } }
        }
      },
      scales: {
        x: { ticks: { color: '#888', font: { family: 'DM Sans' } }, grid: { color: '#2a2a3a' } },
        y: {
          ticks: { color: '#888', font: { family: 'DM Sans' }, callback: v => v + '%' },
          grid: { color: '#2a2a3a' },
          max: 100
        }
      }
    }
  });
}

// ── LIVE SENTIMENT PREVIEW ─────────────────────────────────────
function setupLivePreview() {
  const textarea = document.getElementById('formReview');
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    const text    = textarea.value.toLowerCase();
    const preview = document.getElementById('sentimentPreview');
    const posWords = ['good','great','excellent','amazing','fantastic','love','best',
                      'awesome','wonderful','brilliant','nice','beautiful','enjoyed',
                      'liked','superb','outstanding','perfect','masterpiece','blockbuster'];
    const negWords = ['bad','terrible','awful','worst','boring','disappointing','hate',
                      'poor','waste','mediocre','dull','weak','horrible','stupid',
                      'pathetic','trash','nonsense','flop','overrated'];
    const pos = posWords.filter(w => text.includes(w)).length;
    const neg = negWords.filter(w => text.includes(w)).length;

    if (!text.trim()) {
      preview.textContent = '';
      preview.className   = 'sentiment-preview';
    } else if (pos > neg) {
      preview.textContent = '✦ Predicted: Positive sentiment';
      preview.className   = 'sentiment-preview pos';
    } else if (neg > pos) {
      preview.textContent = '✦ Predicted: Negative sentiment';
      preview.className   = 'sentiment-preview neg';
    } else {
      preview.textContent = '✦ Predicted: Neutral sentiment';
      preview.className   = 'sentiment-preview neu';
    }
  });
}

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('movieInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') analyze();
  });
  document.getElementById('formMovie').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('formReview').focus();
  });
  setupLivePreview();
});