document.addEventListener('DOMContentLoaded', () => {
  const executeButton = document.getElementById('execute');
  const promptInput = document.getElementById('prompt-input');
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('optimizer-result');
  const optimizedText = document.getElementById('optimized-text');
  const suggestionsList = document.getElementById('suggestions-list');
  const scoreBadge = document.getElementById('score-badge');
  const copyButton = document.getElementById('copy-optimized');
  const replaceButton = document.getElementById('replace-original');

  executeButton.addEventListener('click', async () => {
    const promptText = promptInput.value.trim();
    
    if (!promptText) {
      statusDiv.textContent = 'Please enter a prompt';
      statusDiv.style.color = '#F44336';
      return;
    }

    statusDiv.textContent = 'Analyzing prompt...';
    statusDiv.style.color = '#2196F3';
    resultDiv.style.display = 'none'; // Hide results during analysis

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found');

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(err => {
        throw new Error('Failed to inject analyzer: ' + err.message);
      });

      // Analyze prompt
      const analysis = await chrome.tabs.sendMessage(tab.id, {
        action: "analyzePrompt",
        prompt: promptText
      }).catch(err => ({ error: 'Analysis failed: ' + err.message }));

      if (analysis?.error) throw new Error(analysis.error);

      // Display results
      statusDiv.textContent = 'Analysis complete';
      statusDiv.style.color = '#4CAF50';

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

      replaceButton.onclick = () => {
        promptInput.value = analysis.Optimization.Reword;
        statusDiv.textContent = 'Original prompt replaced!';
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
});
