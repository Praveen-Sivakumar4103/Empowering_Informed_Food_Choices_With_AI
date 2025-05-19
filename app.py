# Signed by Iniya Vasanthan V M (v.m.iniyavasanthan@email.com), Vishal S, Praveen S | GPG Signature verified
from flask import Flask, request, jsonify, send_from_directory
import cv2
import numpy as np
import pytesseract
from PIL import Image
import io
import google.generativeai as genai
from flask_cors import CORS
import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS for frontend communication

# Load API keys from environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

def fetch_news_articles(query="food health"):
    try:
        url = f"https://newsapi.org/v2/top-headlines?category=health&pageSize=10&country=us&apiKey={NEWS_API_KEY}"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        articles = []
        food_keywords = ['food', 'nutrition', 'diet', 'eating', 'health', 'label', 'ingredient']

        for article in data.get('articles', []):
            title = article.get('title', '').lower()
            description = article.get('description', '').lower()

            if any(keyword in title or keyword in description for keyword in food_keywords):
                articles.append({
                    'source': article['source']['name'],
                    'title': article['title'],
                    'description': article.get('description', 'No description available'),
                    'publishedAt': datetime.strptime(article['publishedAt'], '%Y-%m-%dT%H:%M:%SZ').strftime('%d %b %Y'),
                    'url': article['url']
                })
                if len(articles) >= 5:
                    break

        if not articles:
            articles.append({
                'title': 'Daily Nutrition Tips',
                'description': 'Try scanning a food label to get personalized health information',
                'source': 'Health Advisor',
                'publishedAt': datetime.now().strftime('%d %b %Y'),
                'url': '#'
            })

        return articles

    except Exception as e:
        print(f"NewsAPI Error: {str(e)}")
        return [{
            'title': 'Nutrition News Updates',
            'description': 'Our news service is currently unavailable. Check back later.',
            'source': 'System',
            'publishedAt': datetime.now().strftime('%d %b %Y'),
            'url': '#'
        }]

@app.route('/personalized_recommendations', methods=['POST'])
def personalized_recommendations():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')

        if not prompt:
            return jsonify({'status': 'error', 'message': 'No prompt provided'}), 400

        response = model.generate_content(prompt)

        if response and hasattr(response, "text"):
            recommendation = response.text
        else:
            recommendation = "AI response was empty. Please try again."

        return jsonify({'status': 'success', 'recommendation': recommendation})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e), 'recommendation': f"Error: {str(e)}"}), 500

@app.route("/api/news", methods=["GET"])
def get_news():
    try:
        query = request.args.get('query', '').strip()
        articles = fetch_news_articles(query) if query else fetch_news_articles()

        return jsonify({
            'status': 'success',
            'articles': articles,
            'count': len(articles)
        })

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'articles': [{
                'title': 'News Service Update',
                'description': 'We are currently experiencing technical difficulties',
                'source': 'System',
                'publishedAt': datetime.now().strftime('%d %b %Y'),
                'url': '#'
            }]
        }), 500

def preprocess_image(image):
    image = np.array(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2)

def extract_text_from_image(image):
    return pytesseract.image_to_string(image, config='--oem 3 --psm 6').strip()

@app.route("/")
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route("/camera.html")
def serve_camera():
    return send_from_directory('.', 'camera.html')

@app.route("/test_extraction", methods=["POST"])
def test_extraction():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    image = Image.open(io.BytesIO(file.read()))

    processed_image = preprocess_image(image)
    extracted_text = extract_text_from_image(processed_image)

    with open("extracted_texts.txt", "a", encoding="utf-8") as f:
        f.write(extracted_text + "\n")

    generated_content = "No relevant content found."
    try:
        if extracted_text:
            prompt = f"Explain the health implications of {extracted_text}."
            response = model.generate_content(prompt)
            if response and hasattr(response, "text"):
                generated_content = response.text
            else:
                generated_content = "AI response was empty."
        print("Extracted Text:", extracted_text)
        print("AI Response:", generated_content)

    except Exception as e:
        generated_content = f"Error: {str(e)}"
        print("AI Error:", generated_content)

    return jsonify({
        "extracted_text": extracted_text,
        "generated_content": generated_content
    })

@app.route("/capture_image", methods=["POST"])
def capture_image():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        image = Image.open(io.BytesIO(file.read()))
        image.save("captured_image.png")

        return jsonify({"message": "Image captured successfully!"})

    except Exception as e:
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 500

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == "__main__":
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    app.run(host="0.0.0.0", port=5000, debug=True)
