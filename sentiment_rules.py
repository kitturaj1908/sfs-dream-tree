"""
SFS Dream Tree — Content Safety Filter  (POSITIVE-ONLY MODE)
Inspired by Google's Responsible AI principles and Gemini API SafetySettings.

POLICY: POSITIVE-ONLY
  • Messages with any negative / harmful content  → REJECTED
  • Messages with no positive keywords (neutral)  → REJECTED  ← NEW RULE
  • Messages with at least one positive keyword   → APPROVED

Harm Categories (matching Gemini SafetySettings):
  HARM_CATEGORY_HATE_SPEECH
  HARM_CATEGORY_HARASSMENT
  HARM_CATEGORY_SEXUALLY_EXPLICIT
  HARM_CATEGORY_DANGEROUS_CONTENT
  HARM_CATEGORY_NEGATIVE_SENTIMENT   (custom — for a celebratory context)

Block Threshold: BLOCK_LOW_AND_ABOVE (stricter than default — catches even mild negativity)
"""

import re
import unicodedata

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: NORMALIZATION TABLES  (evasion resistance)
# ─────────────────────────────────────────────────────────────────────────────

LEET_MAP = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a',
    '$': 's', '!': 'i', '+': 't', '|': 'i', '#': 'h',
}

HOMOGLYPH_MAP = {
    'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y',
    'х': 'x', 'ѕ': 's', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g', 'ʜ': 'h',
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f',
    'ɢ': 'g', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm',
    'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't',
    'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
}


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: HARM CATEGORY WORD LISTS  (greatly expanded)
# ─────────────────────────────────────────────────────────────────────────────

# ── HATE SPEECH ──────────────────────────────────────────────────────────────
HATE_SPEECH_WORDS = {
    # English slurs & identity attacks
    "retard", "faggot", "dyke", "nigger", "nigga", "spic", "chink", "gook",
    "kike", "wetback", "towelhead", "raghead", "cracker", "honky", "beaner",
    "coon", "darkie", "paki", "wog", "hymie", "heeb", "jap", "slant",
    "zipperhead", "redskin", "injun", "squaw", "halfbreed", "mongrel",
    "savage", "uncivilized", "barbarian",
    # Identity dehumanisation
    "subhuman", "vermin", "parasite", "filth", "scum", "degenerate",
    "inferior", "lesser",
    # Indian caste / communal slurs
    "bhangi", "chamar", "madrasi", "ghati", "bhaiya", "bongali", "mawali",
    "terrorist", "jihadi", "kafir", "infidel", "katua", "bhakt",
    # Communal incitement
    "genocide", "ethnic", "cleanse", "exterminate",
}

# ── HARASSMENT / BULLYING ─────────────────────────────────────────────────────
HARASSMENT_WORDS = {
    # Personal attacks
    "idiot", "moron", "imbecile", "loser", "dumb", "stupid", "ugly",
    "useless", "worthless", "pathetic", "coward", "wimp", "sissy",
    "freak", "weirdo", "creep", "disgusting", "hate", "hateful",
    "bully", "bullying", "mock", "mocking", "ridicule", "humiliate",
    "shame", "shaming", "embarrass", "threaten", "threat", "stalk",
    "harass", "harassment", "abuser", "abuse",
    # Appearance shaming
    "fat", "fatty", "chubby", "obese", "ugly", "hideous", "grotesque",
    "freak", "deformed", "cripple",
    # Intelligence attacks
    "dumbass", "brainless", "braindead", "mindless", "clueless", "ignorant",
    "illiterate", "uneducated",
    # Hindi harassment
    "bewakoof", "pagal", "gadha", "ullu", "donkey", "suar", "pig",
    "kutta", "kutte", "kutti", "bhikhari", "bikhari", "bewakuf",
    "nalayak", "nikamma", "kaamchor", "bekar", "ghatiya",
    # Targeted mockery
    "joke", "laughingstock", "loser",
}

# ── SEXUALLY EXPLICIT ─────────────────────────────────────────────────────────
SEXUALLY_EXPLICIT_WORDS = {
    # English explicit
    "sex", "sexual", "sexually", "porn", "pornography", "porno", "naked",
    "nude", "nudity", "xxx", "orgasm", "penis", "vagina", "dick", "cock",
    "pussy", "cunt", "ass", "boobs", "boob", "tits", "tit", "nipple",
    "whore", "slut", "rape", "rapist", "molest", "molestation", "masturbate",
    "masturbation", "erection", "condom", "bitch", "bastard", "wanker",
    "prick", "hooker", "prostitute", "escort", "stripper", "seduction",
    "seduce", "horny", "kinky", "fetish", "grope", "fondle", "pervert",
    "perverted", "lewd", "lustful", "lust", "aroused", "explicit",
    # Hindi explicit
    "loda", "lauda", "lode", "chut", "gaand", "randi", "muth", "muthal",
    "laundiya", "bhosdike", "bhosdika", "bhosda", "chutiya", "chutiyapa",
    "nangi", "nanga", "sexy", "sexi",
    # Regional explicit (Tamil, Telugu, Kannada, Marathi, Bengali)
    "punda", "omala", "bokka", "lanja", "lavada", "keka", "choda", "chode",
    "shemdi", "zava", "puki", "tunne", "nayi", "thevdiya",
}

# ── DANGEROUS CONTENT ─────────────────────────────────────────────────────────
DANGEROUS_CONTENT_WORDS = {
    # Violence
    "kill", "killing", "killer", "murder", "murderer", "stab", "stabbing",
    "shoot", "shooting", "shot", "bomb", "bombing", "explode", "explosion",
    "blow", "blowup", "attack", "attacker", "assaulted", "assault",
    "beat", "beaten", "beating", "hurt", "harm", "harming",
    # Self-harm / suicide
    "suicide", "suicidal", "hang", "hanging", "slit", "overdose", "die",
    "dying", "dead", "death", "self-harm", "selfharm", "cut", "cutting",
    # Weapons
    "weapon", "gun", "pistol", "rifle", "knife", "blade", "sword",
    "grenade", "explosive", "poison", "acid",
    # Drugs
    "drugs", "drug", "cocaine", "heroin", "meth", "methamphetamine",
    "weed", "marijuana", "opium", "crack", "narcotic", "narcotics",
    "dealer", "dealing", "smuggle", "smuggling",
    # Destruction / terrorism
    "destroy", "destruction", "burn", "arson", "riot", "terror",
    "terrorism", "terrorist", "jihad", "massacre",
    # Hindi dangerous
    "maar", "maaro", "khatam", "jalao", "goli", "kato", "khoon",
}

# ── NEGATIVE SENTIMENT (custom — positive-only celebration context) ─────────────
NEGATIVE_SENTIMENT_WORDS = {
    # Academic / career negativity
    "fail", "failed", "failing", "failure", "failures", "flunk", "flunked",
    "dropout", "expelled", "suspended", "detention",
    # Quality descriptors
    "worst", "bad", "terrible", "horrible", "awful", "dreadful", "atrocious",
    "appalling", "ghastly", "hideous", "vile", "disgusting", "repulsive",
    "revolting", "nauseating", "wretched", "miserable", "pathetic",
    # Boredom / disinterest
    "boring", "bored", "dull", "tedious", "monotonous", "stale", "bland",
    "dreary", "tiresome", "exhausting", "pointless", "meaningless", "dull",
    # Waste / scam
    "waste", "wasted", "wasting", "useless", "pointless", "futile", "vain",
    "worthless", "hopeless", "helpless", "scam", "fraud", "fraud",
    "cheater", "cheat", "cheating", "liar", "lying", "lie", "lies",
    "fake", "faker", "phony", "sham", "con", "deceive", "deception",
    # Emotions: sadness / anger / fear
    "sad", "sadness", "upset", "unhappy", "miserable", "depressed",
    "depression", "anxious", "anxiety", "stressed", "stress", "worried",
    "worry", "worried", "scared", "fear", "afraid", "terrified", "terror",
    "panic", "paranoid", "nervous", "dread", "horror", "angry", "anger",
    "furious", "rage", "outrage", "frustrated", "frustration", "irritated",
    "annoyed", "annoying", "annoyance", "irritating", "infuriating",
    # Hopelessness
    "hopeless", "helpless", "defeated", "broken", "shattered", "ruined",
    "ruin", "destroyed", "crushed", "overwhelmed", "desperate", "despair",
    "despairing", "give up", "giving up", "quit", "quitter", "dropout",
    # Loneliness
    "lonely", "alone", "isolated", "abandoned", "forgotten", "rejected",
    "unwanted", "unloved", "friendless", "outcast", "excluded",
    # Regret
    "regret", "regrets", "regretting", "sorry", "ashamed", "shame",
    "embarrassed", "humiliated", "guilty", "guilt",
    # Negativity about the institution / event
    "corrupt", "corruption", "dirty", "rotten", "broken", "dysfunctional",
    "bureaucracy", "nepotism", "unfair", "injustice",
    # Hindi negative
    "bakwaas", "bakwas", "faltu", "bekar", "ganda", "gandagi", "kachra",
    "tatti", "nalayak", "nikamma", "kaamchor", "tang", "pareshan",
    "dukhi", "udas", "gussa", "naraaz", "chidchida",
}

# ── PROFANITY (all languages, catch-all) ─────────────────────────────────────
ALL_PROFANITY = {
    # English profanity
    "fuck", "fucker", "fucking", "fucked", "fuckup", "fck", "fuk",
    "shit", "shitty", "shitter", "shithead", "bullshit", "horseshit",
    "crap", "crappy", "damn", "damned", "dammit", "goddamn", "hell",
    "asshole", "arsehole", "motherfucker", "mf", "sob",
    "bollocks", "wanker", "bastards", "shite",
    # Hindi profanity
    "mc", "bc", "bhenchod", "bhen", "madarchod", "maderchod",
    "gandu", "harami", "haramzada", "haramzadi", "saala", "saali",
    "kamine", "kamina", "kamini", "saale", "raand", "bhadwa", "bhadwe",
    "katto", "chotiya", "sala",
    # Regional profanity
    "sollu", "khoka", "boka", "halat", "kuchiku", "saavdha",
    "thevdiya", "pottai", "sunni", "soothu",
}

# ─────────────────────────────────────────────────────────────────────────────
# Merge sets for fast lookup
# ─────────────────────────────────────────────────────────────────────────────
IMMEDIATE_BLOCK_WORDS = (
    HATE_SPEECH_WORDS |
    SEXUALLY_EXPLICIT_WORDS |
    DANGEROUS_CONTENT_WORDS |
    ALL_PROFANITY
)

GRADUATED_BLOCK_WORDS = (
    HARASSMENT_WORDS |
    NEGATIVE_SENTIMENT_WORDS
)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: POSITIVE VOCABULARY  (expanded — only these pass)
# ─────────────────────────────────────────────────────────────────────────────
POSITIVE_WORDS = {
    # Achievement & success
    "dream", "dreams", "dreamer", "success", "successful", "succeed",
    "achieve", "achievement", "accomplishment", "excel", "excellence",
    "outstanding", "brilliant", "talented", "gifted", "capable", "skilled",
    "master", "champion", "winner", "triumph", "victory",
    # Learning & growth
    "learn", "learning", "knowledge", "wisdom", "educate", "education",
    "study", "studying", "student", "scholar", "research", "explore",
    "discover", "discovery", "curiosity", "curious", "evolve", "grow",
    "growth", "progress", "improve", "improvement", "develop", "development",
    # Emotions: positive
    "happy", "happiness", "joyful", "joy", "excited", "excitement",
    "thrilled", "delighted", "elated", "cheerful", "blissful", "euphoric",
    "grateful", "gratitude", "thankful", "thankfulness", "blessed",
    "content", "proud", "proudly", "pride", "glad", "wonderful", "fantastic",
    "amazing", "awesome", "magnificent", "splendid", "marvelous", "superb",
    "great", "excellent", "best", "top", "super", "nice", "cool",
    # Friendship & community
    "friend", "friends", "friendship", "together", "unity", "united",
    "community", "team", "teamwork", "support", "supportive", "help",
    "helpful", "kind", "kindness", "care", "caring", "compassion",
    "empathy", "love", "loving", "affection", "bond", "connection",
    "belonging", "inclusive", "inclusion", "welcome", "welcoming",
    # College & future
    "college", "sfs", "campus", "inauguration", "future", "career",
    "opportunity", "opportunities", "journey", "path", "goal", "goals",
    "aspire", "aspiration", "ambition", "ambitious", "inspire", "inspired",
    "inspiration", "motivate", "motivated", "motivation", "believe",
    "belief", "confident", "confidence", "hopeful", "hope",
    # Values & character
    "honest", "honesty", "integrity", "respect", "respectful", "honor",
    "trust", "trustworthy", "responsible", "responsibility", "discipline",
    "dedication", "hardwork", "hardworking", "persevere", "perseverance",
    "resilient", "resilience", "courage", "courageous", "brave",
    # Creativity & innovation
    "create", "creative", "creativity", "innovate", "innovation",
    "innovative", "design", "build", "build", "inventor", "invent",
    "imagine", "imagination", "vision", "visionary", "pioneer", "lead",
    # Energy & enthusiasm
    "energy", "energetic", "enthusiasm", "enthusiastic", "passionate",
    "passion", "drive", "driven", "dynamic", "vibrant", "alive",
    "thrive", "flourish", "bloom", "shine", "glow", "bright", "radiant",
    # Specific positive phrases (single-word forms)
    "peace", "peaceful", "harmony", "harmonious", "balance", "stable",
    "healthy", "wellbeing", "wellness", "fit", "fresh", "new", "begin",
    "start", "forward", "onward", "upward", "positive", "optimistic",
    "optimism", "cheerful", "smile", "smiling", "laugh", "laughter",
    "enjoy", "enjoying", "celebrate", "celebration", "milestone",
    "memorable", "unforgettable", "beautiful", "beauty", "perfect",
    "meaningful", "purposeful", "fulfilling", "fulfillment", "worthy",
    "valued", "cherished", "treasured", "special",
}

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: HARM CATEGORY METADATA
# ─────────────────────────────────────────────────────────────────────────────
HARM_CATEGORIES = {
    "HATE_SPEECH": {
        "level": "HIGH",
        "reason": "Contains hate speech or discriminatory language",
        "words": HATE_SPEECH_WORDS,
    },
    "SEXUALLY_EXPLICIT": {
        "level": "HIGH",
        "reason": "Contains sexually explicit content",
        "words": SEXUALLY_EXPLICIT_WORDS,
    },
    "DANGEROUS_CONTENT": {
        "level": "HIGH",
        "reason": "Contains dangerous or violent content",
        "words": DANGEROUS_CONTENT_WORDS,
    },
    "PROFANITY": {
        "level": "HIGH",
        "reason": "Contains profanity or strong offensive language",
        "words": ALL_PROFANITY,
    },
    "HARASSMENT": {
        "level": "MEDIUM",
        "reason": "Contains harassment or personal attack language",
        "words": HARASSMENT_WORDS,
    },
    "NEGATIVE_SENTIMENT": {
        "level": "MEDIUM",
        "reason": "Contains negative sentiment not suitable for an inauguration",
        "words": NEGATIVE_SENTIMENT_WORDS,
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: TEXT NORMALIZATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def normalize_unicode(text: str) -> str:
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii', 'ignore')

def apply_homoglyph_map(text: str) -> str:
    return ''.join(HOMOGLYPH_MAP.get(ch, ch) for ch in text)

def apply_leet_speak(text: str) -> str:
    return ''.join(LEET_MAP.get(ch, ch) for ch in text)

def remove_repeated_chars(text: str) -> str:
    """Collapse 3+ repeated chars: haaate → haate (keeps 2 so 'good' stays 'good')"""
    return re.sub(r'(.)\1{2,}', r'\1\1', text)

def normalize_text(raw: str) -> str:
    text = str(raw).strip()
    text = apply_homoglyph_map(text)
    text = normalize_unicode(text)
    text = apply_leet_speak(text)
    text = text.lower()
    text = remove_repeated_chars(text)
    return text

def clean_text(text: str) -> str:
    text = str(text).strip()
    text = re.sub(r'\s+', ' ', text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: MATCHING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def get_word_tokens(normalized: str) -> list:
    return re.findall(r'\b\w+\b', normalized)

def get_collapsed_text(normalized: str) -> str:
    return re.sub(r'[^a-z]', '', normalized)

def match_word_in_tokens(word: str, tokens: list) -> bool:
    return word in tokens

def match_word_collapsed(word: str, collapsed: str) -> bool:
    if len(word) >= 4:
        return word in collapsed
    return False

def match_word_spaced_pattern(word: str, normalized: str) -> bool:
    if len(word) >= 4:
        pattern = r'.?'.join(re.escape(ch) for ch in word)
        return bool(re.search(pattern, normalized))
    return False


# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7: MAIN ANALYZE FUNCTION  — POSITIVE-ONLY MODE
# ─────────────────────────────────────────────────────────────────────────────

def analyze_sentiment(text: str) -> dict:
    """
    POSITIVE-ONLY POLICY:
      • Contains any harmful / negative word  → REJECTED
      • No positive keyword found (neutral)   → REJECTED  (only positives shown)
      • Has at least one positive keyword     → APPROVED

    Returns:
        dict with: sentiment, score, is_banned, harm_category, harm_level,
                   decision, reason
    """
    cleaned = clean_text(text)

    if not cleaned:
        return _reject("Message is empty", "NONE", False)

    # --- RULE 1: Script Validation ---
    allowed_pattern = (
        r'^[a-zA-Z0-9\s\.,!?\'\"\(\)\[\]\-\u0900-\u097F'
        r'\u2600-\u27BF\U0001F300-\U0001F9FF'
        r'\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF'
        r']+$'
    )
    if cleaned and not re.match(allowed_pattern, cleaned):
        return _reject(
            "Contains unsupported character scripts or symbols",
            "DANGEROUS_CONTENT", True
        )

    # --- Build normalized variants ---
    normalized = normalize_text(cleaned)
    tokens = get_word_tokens(normalized)
    collapsed = get_collapsed_text(normalized)

    # --- RULE 2: Scan all harm categories (HIGH first, then MEDIUM) ---
    for category_name, category_info in HARM_CATEGORIES.items():
        words = category_info["words"]
        level = category_info["level"]
        reason = category_info["reason"]
        is_high = (level == "HIGH")

        for word in words:
            triggered = (
                match_word_in_tokens(word, tokens) or
                match_word_collapsed(word, collapsed) or
                match_word_spaced_pattern(word, normalized)
            )
            if triggered:
                return _reject(
                    f"{reason} — keyword flagged",
                    category_name,
                    is_high
                )

    # --- RULE 3: POSITIVE-ONLY CHECK ---
    # Count matching positive keywords in the message
    pos_count = sum(1 for t in tokens if t in POSITIVE_WORDS)

    if pos_count > 0:
        return {
            "sentiment": "positive",
            "score": pos_count,
            "is_banned": False,
            "harm_category": "NONE",
            "harm_level": "NONE",
            "decision": "approved",
            "reason": "Approved — positive content"
        }
    else:
        # NEUTRAL → REJECTED in positive-only mode
        return _reject(
            "Message does not contain positive sentiment — only uplifting messages are shown on the Dream Tree",
            "NEGATIVE_SENTIMENT",
            False
        )


def _reject(reason: str, harm_category: str, is_banned: bool) -> dict:
    """Helper to build a standardised rejection response."""
    return {
        "sentiment": "negative",
        "score": -100,
        "is_banned": is_banned,
        "harm_category": harm_category,
        "harm_level": "HIGH" if is_banned else "MEDIUM",
        "decision": "rejected",
        "reason": reason
    }
