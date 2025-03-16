// Station 2 codename verification script
let validatedPlayerId = null;
let serverConfig = {
  apiServerUrl: window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin,
  hasCentralBackend: false
};

// Initialize codename verification system
function initializeCodenameVerification() {
  // First, fetch server configuration to ensure proper API routing
  fetchServerConfig()
    .then(() => {
      setupVerificationUI();
    })
    .catch(() => {
      // If there was an error, continue with default server URL
      console.warn("Failed to fetch server configuration, using default URL:", serverConfig.apiServerUrl);
      setupVerificationUI();
    });
}

// Fetch server configuration from the server
function fetchServerConfig() {
  console.log("Fetching server configuration...");
  
  // Use the current origin to fetch the initial config
  const initialUrl = window.location.origin + "/server-config";
  
  return fetch(initialUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch server config: ${response.status}`);
      }
      return response.json();
    })
    .then(config => {
      console.log("Server configuration received:", config);
      
      // Update the server URL if a central backend is specified
      if (config.apiServerUrl) {
        serverConfig.apiServerUrl = config.apiServerUrl;
        console.log(`Using API server URL: ${serverConfig.apiServerUrl}`);
      }
      
      serverConfig.hasCentralBackend = config.hasCentralBackend;
    });
}

// Set up the verification UI after server config is loaded
function setupVerificationUI() {
  const serverUrl = serverConfig.apiServerUrl;
  const verifyButton = document.getElementById("verify-button");
  const errorMessage = document.getElementById("error-message");
  const verificationOverlay = document.getElementById("codename-verification");
  const codenamePreview = document.getElementById("codename-preview");
  const firstColumn = document.getElementById("first-column");
  const secondColumn = document.getElementById("second-column");
  const thirdColumn = document.getElementById("third-column");
  
  // Selected components
  let selectedComponents = {
    first: null,
    second: null,
    third: null
  };
  
  // Load codename components from server
  fetch(`${serverUrl}/utils/codeNameComponents.json`)
    .then(response => response.json())
    .then(components => {
      // Populate first column
      components.first.forEach(component => {
        const button = createComponentButton(component, "first");
        firstColumn.appendChild(button);
      });
      
      // Populate second column
      components.second.forEach(component => {
        const button = createComponentButton(component, "second");
        secondColumn.appendChild(button);
      });
      
      // Populate third column
      components.third.forEach(component => {
        const button = createComponentButton(component, "third");
        thirdColumn.appendChild(button);
      });
    })
    .catch(error => {
      console.error("Error loading codename components:", error);
      errorMessage.textContent = "加载代号组件失败";
    });
  
  // Create component button
  function createComponentButton(component, type) {
    const button = document.createElement("button");
    button.textContent = component;
    button.className = "codename-button";
    button.dataset.component = component;
    button.dataset.type = type;
    
    button.addEventListener("click", () => {
      // Deselect previous button in this column
      if (selectedComponents[type]) {
        document.querySelectorAll(`.codename-button[data-type="${type}"].selected`).forEach(btn => {
          btn.classList.remove("selected");
        });
      }
      
      // Select this button
      button.classList.add("selected");
      selectedComponents[type] = component;
      
      // Update preview
      updateCodenamePreview();
      
      // Enable submit button if all components selected
      if (selectedComponents.first && selectedComponents.second && selectedComponents.third) {
        verifyButton.disabled = false;
      }
    });
    
    return button;
  }
  
  // Update codename preview
  function updateCodenamePreview() {
    let preview = "";
    
    if (selectedComponents.first) {
      preview += selectedComponents.first;
    } else {
      preview += "_";
    }
    
    if (selectedComponents.second) {
      preview += selectedComponents.second;
    } else {
      preview += "_";
    }
    
    if (selectedComponents.third) {
      preview += selectedComponents.third;
    } else {
      preview += "_";
    }
    
    codenamePreview.textContent = preview;
  }
  
  // Handle verify button click
  verifyButton.addEventListener("click", () => {
    // Build complete codename
    const codename = selectedComponents.first + selectedComponents.second + selectedComponents.third;
    
    console.log("Verifying codename:", codename);
    console.log("Using server URL:", serverUrl);
    
    // Verify codename with server
    fetch(`${serverUrl}/validate-codename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codename })
    })
    .then(response => {
      console.log("Response status:", response.status);
      return response.json();
    })
    .then(data => {
      console.log("Validation response:", data);
      
      if (data.valid === true) {
        console.log("Valid codename, player ID:", data.playerId);
        
        // Make sure playerId exists
        if (!data.playerId) {
          console.error("Error: Player ID missing from response");
          errorMessage.textContent = "验证失败，缺少玩家ID";
          return;
        }
        
        // Store the validated player ID
        validatedPlayerId = data.playerId;
        
        // Also store the server configuration for the story player to use
        window.SERVER_CONFIG = serverConfig;
        
        // Hide verification overlay
        verificationOverlay.style.display = "none";
        
        // Initialize Alpine.js with the story player
        initializeStoryPlayer();
      } else {
        // Invalid codename
        errorMessage.textContent = data.message || "代号无效，请重试";
      }
    })
    .catch(error => {
      console.error("Error verifying codename:", error);
      errorMessage.textContent = "验证失败，请重试";
    });
  });
}

// Initialize Alpine.js story player after verification
function initializeStoryPlayer() {
  // Track initialization to prevent duplicates
  if (window.storyPlayerInitialized) {
    console.warn("Story player already initialized! Ignoring duplicate call.");
    return;
  }
  
  window.storyPlayerInitialized = true;
  
  // Store validated player ID
  window.VALIDATED_PLAYER_ID = validatedPlayerId;
  
  // Also pass server configuration from verification process
  window.SERVER_CONFIG = serverConfig;
  
  console.log(`[INIT] Starting story player initialization with player ID: ${validatedPlayerId}`);
  console.log(`[INIT] Using server URL: ${serverConfig.apiServerUrl}`);
  console.log(`[INIT] Loading Alpine.js and story-player.js...`);
  
  // First, dynamically load the story-player.js script
  const storyPlayerScript = document.createElement('script');
  storyPlayerScript.src = '/shared/story-player.js?nocache=' + new Date().getTime(); // Add cache buster
  
  storyPlayerScript.onload = function() {
    console.log(`[INIT] story-player.js loaded at ${new Date().toISOString()}`);
    
    // Create the Alpine.js script
    const alpineScript = document.createElement('script');
    alpineScript.src = 'https://unpkg.com/alpinejs@3.11.1/dist/cdn.min.js';
    
    // When Alpine.js loads, set up the story player container
    alpineScript.onload = function() {
      console.log(`[INIT] Alpine.js loaded at ${new Date().toISOString()}`);
      
      // Clear any previous content in the story container
      const storyContainer = document.querySelector("#story-container");
      storyContainer.innerHTML = '';
      
      // Create a small delay to ensure Alpine is fully initialized
      setTimeout(() => {
        console.log(`[INIT] Creating Alpine component at ${new Date().toISOString()}`);
        
        // Initialize Alpine.js with the storyPlayer component and static ASCII borders
        storyContainer.innerHTML = `
          <div x-data="storyPlayer" x-init="init()">
            <div id="player-data"></div>
            <div class="ascii-border top" id="ascii-top">+-------------------------------------------------------------+</div>
            <div id="passage-container" class="with-static-borders">
              <!-- Left vertical border -->
              <div class="static-vertical-border left-border">
                |<br>|<br>|<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.
              </div>
              
              <!-- Right vertical border -->
              <div class="static-vertical-border right-border">
                |<br>|<br>|<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.<br>.
              </div>
              
              <!-- Passages will be rendered here -->
            </div>
          </div>
        `;
        
        console.log(`[INIT] Story player initialized with player ID: ${validatedPlayerId}`);
      }, 200);
    };
    
    // Add Alpine.js script to the page
    document.body.appendChild(alpineScript);
  };
  
  // Add story-player.js script to the page
  document.body.appendChild(storyPlayerScript);
}