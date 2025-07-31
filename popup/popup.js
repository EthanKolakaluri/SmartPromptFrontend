document.addEventListener('DOMContentLoaded', () => {
  const executeButton = document.getElementById('execute');
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('optimizer-result');
  const optimizedText = document.getElementById('optimized-text');
  const suggestionsList = document.getElementById('suggestions-list');
  const scoreBadge = document.getElementById('score-badge');
  const copyButton = document.getElementById('copy-optimized');
  const limitMessage = document.getElementById('limit-message');

  // Fingerprint generator (no permissions needed)
  const traits = [
    navigator.hardwareConcurrency,
    screen.width,
    navigator.language,
    navigator.userAgent.split('Chrome/')[1]?.split('.')[0] || 'unknown',
  ].join('_');

   // Cache functions (corrected)
  const getCachedResult = async (promptText) => {  // Removed tab parameter
    const result = await chrome.storage.local.get(promptText);
    return result[promptText];
  };

  const setCachedResult = async (promptText, analysis) => {  // Removed tab parameter
    await chrome.storage.local.set({ 
      [promptText]: analysis,
      [`${promptText}_timestamp`]: Date.now()
    });
  };

  // Check limits on popup open
  chrome.runtime.sendMessage({ action: "checkLimit",  readOnlyCheck: true , traits}, (response) => {
    if (response.blocked) {
      limitMessage.innerHTML = `
        <p>You've used ${response.usage}/${response.DAILY_LIMIT} optimizations today!</p>
        <small>Join our <a href="#" id="waitlist-link">waitlist</a> for unlimited access in the future.</small>
      `;
      limitMessage.style.display = 'block';
      document.getElementById('main-content').style.display = 'none';
      
      document.getElementById('waitlist-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://docs.google.com/forms/d/e/1FAIpQLSeREaRGH7fAJy7UDj22mJ6hODO-jM1Lt9trJNyI4KER6nImYw/viewform?usp=dialog' });
      });
    }
  });

  executeButton.addEventListener('click', async () => {

    try {

      // Double-check limits
      const limitCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "checkLimit", traits }, resolve);
      });
      if (limitCheck.blocked) throw new Error(`Limit reached: ${limitCheck.usage}/${limitCheck.DAILY_LIMIT}`);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on ChatGPT
      if (!(tab?.url?.includes('chatgpt.com') || tab?.url?.includes('lovable.dev') ||
       tab?.url?.includes('claude.ai'))) {
        throw new Error('Please open another site');
      }

      // Fetch prompt content ONCE when clicked
      const injectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (url) => {
          let paragraphs;

          if (url.startsWith('https://claude.ai')) {
            paragraphs = document.querySelectorAll('.ProseMirror p, [class*="ProseMirror"] p');
          } else if (url.startsWith('https://lovable.dev')) {
            return document.getElementById('chatinput')?.value || null;
          } else { // ChatGPT
            paragraphs = document.querySelectorAll('#prompt-textarea p');
          }

          // Shadow DOM fallback
          if (paragraphs.length === 0) {
            let shadowRootElement;

            if (url.startsWith('https://claude.ai')) {
              const proseMirror = document.querySelector('.ProseMirror');
              shadowRootElement = proseMirror?.shadowRoot;
            } else if (url.startsWith('https://chatgpt.com')) {
              const textarea = document.getElementById('prompt-textarea');
              shadowRootElement = textarea?.shadowRoot?.querySelector('div[contenteditable]');
            }

            paragraphs = shadowRootElement?.querySelectorAll('p') || [];
          }

          return paragraphs.length > 0 
            ? Array.from(paragraphs).map(p => p.textContent.trim()).join('\n\n')
            : null;
        },
        args: [tab.url]
      });

      const promptText = injectionResult[0]?.result;
      
      if (!promptText?.trim()) {
        throw new Error('No text found in the input box.');
      }

      if (!tab) throw new Error('No active tab found');

      statusDiv.textContent = 'Analyzing Prompt...';
      statusDiv.style.color = '#808080';
      resultDiv.style.display = 'none'; // Hide results during analysis

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(err => {
        throw new Error('Failed to inject analyzer: ' + err.message);
      });

      let analysis;

      // Check cache first
      const cachedResult = await getCachedResult(promptText);

      if (cachedResult) {
        analysis = cachedResult;
      } else {

        analysis = await chrome.tabs.sendMessage(tab.id, {
          action: "analyzePrompt",
          prompt: promptText
        }).catch(err => ({ error: 'Analysis failed: ' + err.message }));

        if (analysis?.error) throw new Error(analysis.error);

        // Cache the new result (only if successful)
        await setCachedResult(promptText, analysis);
      }

      // Display results
      statusDiv.textContent = 'Analysis Complete';
      statusDiv.style.color = '#808080';

      // Update score badge
      const scoreColor = analysis.Evaluation.Accuracy >= 80 ? '#4CAF50' :
                        analysis.Evaluation.Accuracy >= 60 ? '#FFC107' : '#F44336';
      scoreBadge.textContent = `${analysis.Evaluation.Accuracy}%`;
      scoreBadge.style.backgroundColor = scoreColor;

      // Update optimized text
      optimizedText.textContent = analysis.Optimization.Reword;

      // Update suggestions
      suggestionsList.innerHTML = analysis.Evaluation.Suggestions?.length > 0
        ? analysis.Evaluation.Suggestions.map(s => `<li>${s}</li>`).join('')
        : '<li>No suggestions available</li>';

      // Set up button actions
      copyButton.onclick = () => {
        navigator.clipboard.writeText(analysis.Optimization.Reword);
        statusDiv.textContent = 'Copied to clipboard!';
        statusDiv.style.color = '#4CAF50';
      };

      // Show results container
      resultDiv.style.display = 'block';

    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.style.color = '#F44336';
      console.error('Optimization error:', error);
    }
  });

  // Add cache cleanup (optional but recommended)
  // Optimized cache cleanup
  const cleanOldCache = async () => {
    const now = Date.now();
    const allItems = await chrome.storage.local.get(null);
    
    await Promise.all(
      Object.entries(allItems)
        .filter(([key, val]) => key.endsWith('_timestamp') && now - val > 604800000)
        .map(([key]) => 
          chrome.storage.local.remove([key.replace('_timestamp', ''), key])
        )
    );
  };
  
  // Run cleanup on startup and daily
  cleanOldCache();
  setInterval(cleanOldCache, 24 * 60 * 60 * 1000);
});
