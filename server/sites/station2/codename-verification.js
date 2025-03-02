// Station 2 codename verification script
let validatedPlayerId = null;

// Initialize codename verification system
function initializeCodenameVerification() {
  const serverUrl = "http://localhost:3001";
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
  // Very simple approach - directly override the player ID in the story-player.js
  window.VALIDATED_PLAYER_ID = validatedPlayerId;
  
  // Initialize Alpine.js with the storyPlayer component
  document.querySelector("#story-container").innerHTML = `
    <div x-data="storyPlayer" x-init="init()">
      <div id="player-data"></div>
      <div id="passage-container">
        <!-- Passages will be rendered here -->
      </div>
      <div id="status-bar" x-text="'Story Player ID: ' + config.playerId"></div>
    </div>
  `;
  
  console.log("Story player initialized with player ID:", validatedPlayerId);
}