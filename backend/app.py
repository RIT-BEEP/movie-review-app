from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import csv, os, requests
from datetime import date
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

REVIEWS_FILE = os.path.join(os.path.dirname(__file__), 'reviews.csv')
OMDB_API_KEY = os.getenv('OMDB_API_KEY', '262ff25f')

# ─── CSV helpers ────────────────────────────────────────────────

def load_reviews():
    reviews = []
    try:
        with open(REVIEWS_FILE, newline='', encoding='utf-8') as f:
            for row in csv.reader(f):
                if len(row) < 4:
                    continue
                if len(row) >= 6:
                    movie, review, sentiment, rating = row[1], row[2], row[3], row[4]
                else:
                    movie, review, sentiment, rating = row[0], row[1], row[2], row[3]
                reviews.append({
                    'movie': movie.strip().lower(),
                    'review': review.strip(),
                    'sentiment': sentiment.strip(),
                    'rating': rating.strip(),
                })
    except FileNotFoundError:
        pass
    return reviews

def detect_sentiment(text):
    text = text.lower()
    pos_words = ['good','great','excellent','amazing','fantastic','love','best',
                 'awesome','wonderful','brilliant','nice','beautiful','enjoyed',
                 'liked','superb','outstanding','perfect','masterpiece','blockbuster']
    neg_words = ['bad','terrible','awful','worst','boring','disappointing','hate',
                 'poor','waste','mediocre','dull','weak','horrible','stupid',
                 'pathetic','trash','nonsense','flop','worst','overrated']
    pos = sum(1 for w in pos_words if w in text)
    neg = sum(1 for w in neg_words if w in text)
    if pos > neg: return 'Positive'
    elif neg > pos: return 'Negative'
    return 'Neutral'

def save_review(movie, review, sentiment, rating):
    try:
        with open(REVIEWS_FILE, 'r', encoding='utf-8') as f:
            count = sum(1 for line in f if line.strip())
    except FileNotFoundError:
        count = 0
    with open(REVIEWS_FILE, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([
            count, movie.lower(), review, sentiment,
            rating, date.today().strftime('%d-%m-%Y')
        ])

# ─── OMDB: fetch real movie info ────────────────────────────────

def fetch_omdb(movie_name):
    try:
        url = f"http://www.omdbapi.com/?t={movie_name}&apikey={OMDB_API_KEY}&plot=short"
        res = requests.get(url, timeout=5)
        data = res.json()
        if data.get('Response') == 'True':
            return data
    except:
        pass
    return None

# ─── Routes ─────────────────────────────────────────────────────

@app.route('/add_review', methods=['POST'])
def add_review():
    data = request.get_json()
    movie  = data.get('movie', '').strip()
    review = data.get('review', '').strip()
    rating = data.get('rating', '3').strip()

    if not movie or not review:
        return jsonify({'error': 'Movie name aur review dono bharo'}), 400

    sentiment = detect_sentiment(review)
    save_review(movie, review, sentiment, rating)

    return jsonify({
        'success': True,
        'sentiment': sentiment,
        'message': f'Review saved! Sentiment: {sentiment}'
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    data  = request.get_json()
    query = data.get('movie', '').strip().lower()

    all_reviews = load_reviews()
    local = [r for r in all_reviews if r['movie'] == query]

    omdb = fetch_omdb(query)

    if not local and not omdb:
        return jsonify({'error': f'"{query}" ke liye koi data nahi mila'}), 404

    total = len(local)
    if total > 0:
        sentiments = [r['sentiment'].capitalize() for r in local]
        pos = sentiments.count('Positive')
        neg = sentiments.count('Negative')
        neu = sentiments.count('Neutral')
        pos_pct = round(pos / total * 100)
        neg_pct = round(neg / total * 100)
        neu_pct = round(neu / total * 100)
        local_ratings = []
        for r in local:
            try: local_ratings.append(float(r['rating']))
            except: pass
        avg_rating = round(sum(local_ratings)/len(local_ratings), 1) if local_ratings else 0
    else:
        pos_pct = neg_pct = neu_pct = avg_rating = 0
        pos = neg = neu = 0

    omdb_rating  = None
    imdb_rating  = None
    rt_rating    = None
    plot         = None
    genre        = None
    director     = None
    year         = None
    poster       = None
    awards       = None
    runtime      = None
    actors       = None
    omdb_verdict = None

    if omdb:
        plot      = omdb.get('Plot')
        genre     = omdb.get('Genre')
        director  = omdb.get('Director')
        year      = omdb.get('Year')
        poster    = omdb.get('Poster')
        awards    = omdb.get('Awards')
        runtime   = omdb.get('Runtime')
        actors    = omdb.get('Actors')

        try:
            imdb_rating = float(omdb.get('imdbRating', 0))
        except:
            imdb_rating = None

        for src in omdb.get('Ratings', []):
            if src['Source'] == 'Rotten Tomatoes':
                rt_rating = src['Value']

        if imdb_rating:
            if imdb_rating >= 7.5:
                omdb_verdict = 'WATCH'
            elif imdb_rating >= 5.5:
                omdb_verdict = 'MAYBE'
            else:
                omdb_verdict = 'SKIP'

    if total >= 3:
        if pos_pct >= 60:
            verdict = 'WATCH'
            verdict_reason = f'{pos_pct}% local audience ne positively react kiya!'
        elif neg_pct > 50:
            verdict = 'SKIP'
            verdict_reason = f'{neg_pct}% negative reviews — shayad skip karo.'
        else:
            verdict = 'MAYBE'
            verdict_reason = 'Mixed local reviews — genre pasand ho toh dekho.'
    elif omdb_verdict:
        verdict = omdb_verdict
        verdict_reason = f'IMDb rating {imdb_rating}/10 ke basis pe recommendation.'
    else:
        verdict = 'MAYBE'
        verdict_reason = 'Abhi zyada reviews nahi hain — khud decide karo!'

    love_pct  = round(pos_pct * 0.85)
    hype_pct  = round((pos_pct + neu_pct) * 0.6)
    rewatch   = 'High' if avg_rating >= 4 or (imdb_rating and imdb_rating >= 8) else \
                'Medium' if avg_rating >= 3 or (imdb_rating and imdb_rating >= 6) else 'Low'

    return jsonify({
        'movie':          query.title(),
        'year':           year,
        'genre':          genre,
        'director':       director,
        'actors':         actors,
        'plot':           plot,
        'poster':         poster,
        'awards':         awards,
        'runtime':        runtime,
        'total_reviews':  total,
        'rating':         avg_rating,
        'imdb_rating':    imdb_rating,
        'rt_rating':      rt_rating,
        'positive_pct':   pos_pct,
        'negative_pct':   neg_pct,
        'neutral_pct':    neu_pct,
        'love_pct':       love_pct,
        'hype_pct':       hype_pct,
        'verdict':        verdict,
        'verdict_reason': verdict_reason,
        'rewatch_value':  rewatch,
    })

@app.route('/stats', methods=['GET'])
def stats():
    reviews = load_reviews()
    total   = len(reviews)
    if total == 0:
        return jsonify({'positive': 0, 'negative': 0, 'neutral': 0, 'total': 0})
    sentiments = [r['sentiment'].capitalize() for r in reviews]
    return jsonify({
        'positive': round(sentiments.count('Positive') / total * 100),
        'negative': round(sentiments.count('Negative') / total * 100),
        'neutral':  round(sentiments.count('Neutral')  / total * 100),
        'total':    total
    })

@app.route('/movies', methods=['GET'])
def movies():
    reviews = load_reviews()
    names   = sorted({r['movie'].title() for r in reviews})
    return jsonify({'movies': names})

@app.route('/')
def home():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('../frontend', filename)

# ─── Run ────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
                 