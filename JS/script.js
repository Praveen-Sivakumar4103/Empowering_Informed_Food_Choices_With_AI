/*Signed by Iniya Vasanthan V M (v.m.iniyavasanthan@email.com), Vishal S, Praveen S | GPG Signature verified*/
// Main application functionality
function uploadImage() {
    const fileInput = document.getElementById("imageInput").files[0];
    if (!fileInput) {
        alert("Please select an image file.");
        return;
    }
    resetContentBoxes();
    processImage(fileInput);
}

function openCamera() {
    const cameraWindow = window.open("camera.html", "_blank", "width=500,height=700");
    if (!cameraWindow) {
        alert("Please allow pop-ups for this site to use the camera.");
        return;
    }
    resetContentBoxes();
    window.addEventListener("message", (event) => {
        if (event.data?.image) {
            processImage(event.data.image);
        }
    });
}

function resetContentBoxes() {
    const outputText = document.getElementById("outputText");
    const healthContent = document.getElementById("healthContent");
    const recommendationContent = document.getElementById("recommendationContent");
    
    outputText.textContent = "No text extracted yet.";
    healthContent.innerHTML = "No analysis available yet.";
    recommendationContent.innerHTML = "No recommendations yet. Enter your health concerns and click the button above.";
    
    outputText.style.opacity = 1;
    healthContent.style.opacity = 1;
    recommendationContent.style.opacity = 0;
    recommendationContent.style.display = "none";
    recommendationContent.classList.remove('recommendation-visible');
    
    document.getElementById("textLoader").style.display = "none";
    document.getElementById("healthLoader").style.display = "none";
    document.getElementById("recommendationLoader").style.display = "none";
    document.getElementById("newsSection").style.display = "none";
}

function processImage(imageData) {
    const textLoader = document.getElementById("textLoader");
    const healthLoader = document.getElementById("healthLoader");
    const outputText = document.getElementById("outputText");
    const healthContent = document.getElementById("healthContent");
    
    textLoader.style.display = "block";
    healthLoader.style.display = "block";
    outputText.style.opacity = 0;
    healthContent.style.opacity = 0;
    
    const formData = new FormData();
    formData.append("image", imageData);
    
    fetch("/test_extraction", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        outputText.textContent = data.extracted_text || "No text found.";
        healthContent.innerHTML = (data.generated_content || "No health information available.")
            .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
            .replace(/\n/g, "<br>");
        
        textLoader.style.display = "none";
        healthLoader.style.display = "none";
        outputText.style.opacity = 1;
        healthContent.style.opacity = 1;
        
        if (data.extracted_text?.trim().length > 0) {
            fetchRelatedNews(data.extracted_text);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error extracting text. Check the console.");
        textLoader.style.display = "none";
        healthLoader.style.display = "none";
    });
}

// Personal Health Recommendations
function getPersonalizedRecommendations() {
    const healthConcerns = document.getElementById("healthConcerns").value.trim();
    const extractedText = document.getElementById("outputText").textContent.trim();
    const recommendationContent = document.getElementById("recommendationContent");
    const recommendationLoader = document.getElementById("recommendationLoader");

    // Validate inputs
    if (!healthConcerns) {
        alert("Please enter your health concerns to get personalized recommendations.");
        return;
    }

    if (!extractedText || extractedText === "No text extracted yet." || extractedText === "No text found.") {
        alert("Please scan or upload a food label first to get recommendations.");
        return;
    }

    // RESET TO INITIAL STATE BEFORE MAKING NEW REQUEST
    recommendationContent.style.display = "none";
    recommendationContent.style.opacity = 0;
    recommendationContent.classList.remove('recommendation-visible');
    recommendationContent.innerHTML = "Analyzing your health concerns with the product ingredients...";

    // Show loading state
    recommendationLoader.style.display = "block";

    // Create the AI prompt
    const prompt = `Given these product ingredients: ${extractedText}\n\n` +
                 `And these health concerns: ${healthConcerns}\n\n` +
                 `Provide detailed, personalized recommendations about:\n` +
                 `1. Whether this product is safe to consume with these health conditions\n` +
                 `2. Potential health risks to watch for\n` +
                 `3. Specific ingredients that may cause issues\n` +
                 `4. Suggested alternatives if this product is not recommended\n\n` +
                 `Format your response with clear headings and bullet points for important warnings.`;

    // Call the API
    fetch("/personalized_recommendations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'error') {
            throw new Error(data.message || 'Unknown error from server');
        }
        
        // Format and display the response
        recommendationContent.innerHTML = (data.recommendation || "No recommendations could be generated.")
            .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")  // Bold formatting
            .replace(/\n/g, "<br>")                   // Line breaks
            .replace(/- (.*?)(<br>|$)/g, "• $1$2");   // Bullet points
        
        // Show content with fade-in effect
        recommendationContent.style.display = "block";
        recommendationContent.classList.add('recommendation-visible');
        setTimeout(() => {
            recommendationContent.style.opacity = 1;
        }, 10);
    })
    .catch(error => {
        console.error("Recommendation error:", error);
        recommendationContent.innerHTML = `Error generating recommendations: ${error.message}. Please try again.`;
        recommendationContent.style.display = "block";
        recommendationContent.style.opacity = 1;
        recommendationContent.classList.add('recommendation-visible');
    })
    .finally(() => {
        recommendationLoader.style.display = "none";
    });
}

// News functionality (remain exactly the same as your existing code)
function fetchRelatedNews(query) {
    const newsSection = document.getElementById("newsSection");
    newsSection.style.display = "block";
    
    const keywords = extractKeywords(query);
    const searchQuery = keywords.length > 0 ? keywords.join(' OR ') : 'packaged food health';
    
    fetch(`/api/news?query=${encodeURIComponent(searchQuery)}`)
    .then(response => response.json())
    .then(data => renderNewsCards(data.articles || []))
    .catch(error => {
        console.error("News fetch error:", error);
        fetchDefaultNews();
    });
}

function fetchDefaultNews() {
    fetch('/api/news')
    .then(response => response.json())
    .then(data => renderNewsCards(data.articles || []))
    .catch(() => showNoNewsMessage());
}

function extractKeywords(text) {
    const commonWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'ingredient', 'ingredients']);
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    return [...new Set(words)]
        .filter(word => word.length > 3 && !commonWords.has(word))
        .slice(0, 5);
}

function renderNewsCards(articles) {
    const newsTrack = document.getElementById("newsTrack");
    
    // Remove any existing view-all button
    const existingBtn = document.querySelector('.view-all-container');
    if (existingBtn) existingBtn.remove();
    
    if (!articles.length) {
        newsTrack.innerHTML = `
            <div class="no-news">
                <p>No health news found. Try scanning a food label.</p>
                <button onclick="fetchDefaultNews()">Load General Food News</button>
            </div>
        `;
        return;
    }
    
    newsTrack.innerHTML = articles.map(article => `
        <div class="news-card">
            <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                <div class="news-card-content">
                    <h4>${article.title}</h4>
                    <p class="news-description">${article.description || ''}</p>
                    <div class="news-meta">
                        <span class="news-source">${article.source}</span>
                        <span class="news-date">${article.publishedAt}</span>
                    </div>
                </div>
            </a>
        </div>
    `).join('');
    
    // Add single View All button
    const viewAllContainer = document.createElement('div');
    viewAllContainer.className = 'view-all-container';
    viewAllContainer.innerHTML = `
        <a href="https://www.google.com/search?q=${encodeURIComponent('packaged food health news')}&tbm=nws" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="view-all-btn">
            View All News
        </a>
    `;
    newsTrack.parentNode.insertBefore(viewAllContainer, newsTrack.nextSibling);
}

function showNoNewsMessage() {
    document.getElementById("newsTrack").innerHTML = `
        <div class="no-news">
            <p>No recent news found. Check back later for updates.</p>
        </div>
    `;
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("newsSection").style.display = "none";
    fetchDefaultNews();
});