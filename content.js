// content-script.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzePrompt") {
    // Wrap the async operation in an immediately-invoked async function
    (async () => {
      try {
        const response = await fetch('https://smart-prompt-lake.vercel.app/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({prompt: request.prompt})
        });

        if (!response.ok) {
          throw new Error(`API Error ${response.status}`);
        }

        const data = await response.json();        
        sendResponse(data);
      } catch (error) {
        sendResponse({ 
          error: error.message,
          status: error.response?.status 
        });
      }
    })();

    return true; // Keep message channel open
  }
});

// Auto-init on ChatGPT domains
if (window.location.hostname.includes("chat.openai.com") || 
    window.location.hostname.includes("chatgpt.com")) {
  console.log('Prompt optimizer active');
}
