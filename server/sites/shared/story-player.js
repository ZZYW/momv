document.addEventListener("alpine:init", () => {
  // Create a global flag for Alpine data initialization
  if (window._storyPlayerDataInitialized) {
    console.warn('[ALPINE] storyPlayer data already initialized! Skipping duplicate initialization');
    return;
  }
  window._storyPlayerDataInitialized = true;
  
  console.log('[ALPINE] Initializing storyPlayer data component');
  
  Alpine.data("storyPlayer", () => ({
    // ===== CONFIGURATION =====
    config: {
      serverUrl: "http://localhost:3001",
      // For station2, use the validated player ID if available
      playerId: window.VALIDATED_PLAYER_ID || 
        ("player_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 9)),
      storyPath: "input/story.json",
      debug: true, // Enable debug logging
      // Determine which station this is - used for localStorage namespacing and storyId
      stationId: window.location.pathname.includes("station2") ? "station2" : "station1",
      // Numeric station ID for API calls
      stationNumber: window.location.pathname.includes("station2") ? "2" : "1"
    },

    // ===== STATE =====
    state: {
      projectBlocks: [],
      passages: [],
      currentPassageIndex: 0,
      isLoading: false,
      error: null,
      pendingOptionSelections: 0,
    },

    // ===== INITIALIZATION =====
    init() {
      this.loadStory();
    },

    // ===== LOGGING =====
    log(...args) {
      if (this.config.debug) {
        console.log(...args);
      }
    },

    // ===== STORY LOADING & PARSING =====
    loadStory() {
      console.log(`[STORY] Starting loadStory with playerId: ${this.config.playerId}`);
      console.log(`[STORY] Station ID: ${this.config.stationId}, Station Number: ${this.config.stationNumber}`);
      
      // Add debug info to indicate exact execution context
      console.log(`[STORY] Alpine data loading - time: ${new Date().toISOString()}`);
      console.log(`[STORY] Window validated player ID: ${window.VALIDATED_PLAYER_ID}`);
      
      this.state.isLoading = true;
      fetch(`${this.config.storyPath}?nocache=${new Date().getTime()}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load story (${response.status})`);
          }
          console.log(`[STORY] Story response received, parsing JSON`);
          return response.json();
        })
        .then((data) => {
          console.log(`[STORY] Story data loaded, processing blocks`);
          if (data.blocks && Array.isArray(data.blocks)) {
            this.state.projectBlocks = data.blocks;
            this.groupBlocksIntoPassages();
            this.renderPassage(0);

            // Activate first passage
            const firstPassage = document.getElementById("passage-0");
            if (firstPassage) {
              firstPassage.classList.add("active");
              this.loadDynamicContentForPassage(firstPassage).then(() => {
                this.setupContinueButton(firstPassage);
              });
            }
          } else {
            throw new Error(
              "Invalid story data: missing or invalid blocks array"
            );
          }
        })
        .catch((error) => {
          this.log("Error loading story:", error);
          this.state.error = error.message;
          document.getElementById(
            "passage-container"
          ).innerHTML = `<div class='error'>Error loading story: ${error.message}</div>`;
        })
        .finally(() => {
          this.state.isLoading = false;
        });
    },

    groupBlocksIntoPassages() {
      let current = [];
      this.state.passages = [];

      this.state.projectBlocks.forEach((block) => {
        if (block.type === "scene-header" && current.length > 0) {
          this.state.passages.push(current);
          current = [];
        }
        current.push(block);
      });

      if (current.length > 0) {
        this.state.passages.push(current);
      }

      this.log(
        `Grouped ${this.state.projectBlocks.length} blocks into ${this.state.passages.length} passages`
      );
    },

    // ===== RENDERING =====
    renderPassage(passageIndex) {
      console.log(`[RENDER] Starting renderPassage for passage index ${passageIndex}`);
      
      if (passageIndex >= this.state.passages.length) {
        console.warn(`[RENDER] Invalid passage index: ${passageIndex}, max: ${this.state.passages.length - 1}`);
        return;
      }
      
      // Check if passage already exists
      const existingPassage = document.getElementById(`passage-${passageIndex}`);
      if (existingPassage) {
        console.warn(`[RENDER] Passage ${passageIndex} already exists! Skipping render.`);
        return existingPassage;
      }

      console.log(`[RENDER] Creating new passage element for index ${passageIndex}`);
      const container = document.getElementById("passage-container");
      const blocks = this.state.passages[passageIndex];
      const passageEl = document.createElement("div");

      passageEl.className = "passage";
      passageEl.id = `passage-${passageIndex}`;
      passageEl._rendered = true;

      // Create elements for each block
      blocks.forEach((block) => {
        const blockEl = document.createElement("div");
        blockEl.className = `block-${block.type}`;
        blockEl.style.marginBottom = "20px";

        // Render block based on its type
        blockEl.innerHTML = this.renderBlockContent(block);
        passageEl.appendChild(blockEl);

        // Add event listeners for interactive blocks
        if (block.type === "static") {
          setTimeout(
            () => this.attachStaticOptionHandlers(blockEl, block.id),
            0
          );
        }
      });

      // Add navigation elements
      this.addNavigationToPassage(passageEl, passageIndex);
      container.appendChild(passageEl);
    },

    renderBlockContent(block) {
      // Block renderers by type
      const renderers = {
        plain: (b) => `<div class="plain">${b.text || ""}</div>`,

        static: (b) => {
          if (!Array.isArray(b.options))
            return '<div class="error">No options provided</div>';

          // Create options with dividers
          let optionsHTML = "";
          b.options.forEach((opt, i) => {
            if (i > 0) {
              // Add a divider before all options except the first one
              optionsHTML += `<div class="option-divider">/</div>`;
            }
            optionsHTML += `<div class="static-option" data-idx="${i}">${opt}</div>`;
          });

          return `<div class="static-option-container">${optionsHTML}</div>`;
        },

        "dynamic-option": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Loading dynamic options... <span class="loading"></span></div>
            <div class="dynamic-options-container" data-uuid="${b.id}"></div>
          </div>`,

        "dynamic-text": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Generating text... <span class="loading"></span></div>
            <div class="dynamic-text-container" data-uuid="${b.id}"></div>
          </div>`,

        "dynamic-word": (b) => `
          <div class="dynamic-container">
            <div class="loading-indicator">Generating word... <span class="loading"></span></div>
            <div class="dynamic-word-container" data-uuid="${b.id}"></div>
          </div>`,

        "scene-header": (b) => `<div class="scene-header"> ░▒▓ ${b.titleName || "Scene"} ▓▒░</div>`,
      };

      // Use the appropriate renderer or return an error message
      const renderer = renderers[block.type];
      return renderer
        ? renderer(block)
        : `<div class="error">Unknown block type: ${block.type}</div>`;
    },

    attachStaticOptionHandlers(blockEl, blockId) {
      const options = blockEl.querySelectorAll(".static-option");
      options.forEach((opt) => {
        opt.addEventListener("click", () => {
          this.selectOption(opt, blockId, "static");
        });
      });
    },

    addNavigationToPassage(passageEl, passageIndex) {
      if (passageIndex < this.state.passages.length - 1) {
        const navContainer = document.createElement("div");
        navContainer.className = "navigation-container";

        const continueLink = document.createElement("a");
        continueLink.href = "#";
        continueLink.className = "next-link";
        continueLink.innerText = "继续";
        continueLink.style.display = "none"; // Initially hidden

        continueLink.addEventListener("click", (e) => {
          e.preventDefault();
          this.goToNextPassage(passageIndex);
        });

        navContainer.appendChild(continueLink);
        passageEl.appendChild(navContainer);
      } else {
        // Final passage - story is ending
        
        // Only generate and display codename for Station 1
        if (this.config.stationId === "station1") {
          this.generateAndDisplayCodename(passageEl);
        } else {
          // For other stations, just add "start a new journey" button
          const addNewJourneyButton = () => {
            // Create a container for the new journey button
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "codename-container";
            buttonContainer.style.marginTop = "30px";
            buttonContainer.style.textAlign = "center";
            
            // Add "start a new journey" button
            const newJourneyButton = document.createElement("button");
            newJourneyButton.className = "new-journey-button";
            newJourneyButton.innerText = "开始新的旅程";
            newJourneyButton.addEventListener("click", () => {
              window.location.reload();
            });
            
            buttonContainer.appendChild(newJourneyButton);
            passageEl.appendChild(buttonContainer);
          };
          
          // Check if there are unselected options before showing button
          if (this.passageHasUnselectedOptions(passageEl)) {
            const checkInterval = setInterval(() => {
              if (!this.passageHasUnselectedOptions(passageEl)) {
                clearInterval(checkInterval);
                addNewJourneyButton();
              }
            }, 500);
          } else {
            addNewJourneyButton();
          }
        }
      }
    },
    
    // Generate and display codename options for the player when they complete Station 1
    generateAndDisplayCodename(passageEl) {
      const codenameContainer = document.createElement("div");
      codenameContainer.className = "codename-container";
      codenameContainer.style.display = "none"; // Initially hidden
      
      // Add container to passage
      passageEl.appendChild(codenameContainer);
      
      // Only show the codename options when all other options in the passage have been selected
      if (this.passageHasUnselectedOptions(passageEl)) {
        // If there are unselected options, we'll check repeatedly until they're all selected
        const checkInterval = setInterval(() => {
          if (!this.passageHasUnselectedOptions(passageEl)) {
            clearInterval(checkInterval);
            this.fetchAndDisplayCodenameOptions(codenameContainer);
          }
        }, 500); // Check every 500ms
      } else {
        // If there are no options to select, show codename options right away
        this.fetchAndDisplayCodenameOptions(codenameContainer);
      }
    },
    
    // Helper method to fetch and display codename options
    fetchAndDisplayCodenameOptions(codenameContainer) {
      // Show container
      codenameContainer.style.display = "block";
      
      // Show loading indicator while fetching codename options
      const loadingElement = document.createElement("div");
      loadingElement.className = "codename-loading";
      loadingElement.innerHTML = "生成代号中... <span class='loading'></span>";
      codenameContainer.appendChild(loadingElement);
      
      console.log("Requesting codename options for player:", this.config.playerId);
      console.log("Server URL:", this.config.serverUrl);
      
      // Request codenames from server - we'll modify to get three options
      fetch(`${this.config.serverUrl}/assign-codename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          playerId: this.config.playerId,
          count: 3 // Request 3 codename options
        })
      })
      .then(response => {
        console.log("Server response status:", response.status);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response.json().then(data => {
          console.log("Received codename data:", data);
          return data;
        });
      })
      .then(data => {
        // Get codename options (fallback to single option if server doesn't support multiple)
        const codenames = Array.isArray(data.codenames) ? data.codenames : [data.codename];
        
        // Add a prompt message
        const promptMessage = document.createElement("div");
        promptMessage.className = "codename-prompt";
        promptMessage.innerHTML = "并赐予他法号：";
        
        // Create static-option-container for codename options
        const optionsContainer = document.createElement("div");
        optionsContainer.className = "static-option-container";
        
        // Add each codename as a static-option
        codenames.forEach((codename, i) => {
          // Add divider before all options except the first one
          if (i > 0) {
            const dividerEl = document.createElement("div");
            dividerEl.className = "option-divider";
            dividerEl.textContent = "/";
            optionsContainer.appendChild(dividerEl);
          }
          
          // Create option element
          const optEl = document.createElement("div");
          optEl.className = "static-option";
          optEl.dataset.idx = i;
          optEl.textContent = codename;
          
          // Add click handler
          optEl.addEventListener("click", () => {
            // Handle selection visually
            const allOpts = optionsContainer.querySelectorAll(".static-option");
            
            // Disable all options
            allOpts.forEach(opt => {
              opt.style.pointerEvents = "none";
              opt.style.cursor = "default";
              opt.onclick = null;
            });
            
            // Update UI - mark selected and fade others
            optEl.classList.add("selected");
            allOpts.forEach(o => {
              if (o !== optEl) {
                o.classList.add("faded");
                o.onclick = null;
              }
            });
            
            // Fade dividers
            const dividers = optionsContainer.querySelectorAll(".option-divider");
            dividers.forEach(divider => {
              divider.classList.add("faded");
            });
            
            // Save selected codename to server
            this.saveSelectedCodename(codename);
            
            // Add a small message below the options
            setTimeout(() => {
              // Create a small reminder message
              const reminderMessage = document.createElement("div");
              reminderMessage.className = "codename-reminder";
              reminderMessage.innerHTML = `<p>请务必牢记您的法号……</p>`;
              reminderMessage.style.marginTop = "20px";
              reminderMessage.style.fontSize = "12px";
              reminderMessage.style.opacity = "0.8";
              
              // Add "start a new journey" button
              const newJourneyButton = document.createElement("button");
              newJourneyButton.className = "new-journey-button";
              newJourneyButton.innerText = "开始新的旅程";
              newJourneyButton.style.marginTop = "10px";
              newJourneyButton.addEventListener("click", () => {
                window.location.reload();
              });
              
              // Add these below the options
              codenameContainer.appendChild(reminderMessage);
              codenameContainer.appendChild(newJourneyButton);
            }, 1000); // Short delay for visual transition
          });
          
          optionsContainer.appendChild(optEl);
        });
        
        // Replace loading with options
        codenameContainer.innerHTML = "";
        codenameContainer.appendChild(promptMessage);
        codenameContainer.appendChild(optionsContainer);
      })
      .catch(error => {
        console.error("Error generating codename options:", error);
        codenameContainer.innerHTML = "<div class='error'>无法生成代号，请刷新页面重试。</div>";
      });
    },
    
    // Save the selected codename to server
    saveSelectedCodename(codename) {
      fetch(`${this.config.serverUrl}/save-codename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: this.config.playerId,
          codename: codename
        })
      })
      .then(response => {
        if (!response.ok) {
          console.error("Error saving codename:", response.status);
        }
      })
      .catch(error => {
        console.error("Error saving codename:", error);
      });
    },

    // ===== DYNAMIC CONTENT =====
    loadDynamicContentForPassage(passageElement) {
      console.log(`[LOAD-DYNAMIC] Starting loadDynamicContentForPassage for passage ${passageElement.id}`);
      console.log(`[LOAD-DYNAMIC] Player ID: ${this.config.playerId}`);
      
      // Track if we're already loading this passage
      if (passageElement._dynamicContentLoading) {
        console.warn(`[LOAD-DYNAMIC] Already loading dynamic content for ${passageElement.id}! Returning existing promise.`);
        return passageElement._dynamicContentLoadingPromise;
      }
      
      const dynamicContainers = passageElement.querySelectorAll(
        ".dynamic-options-container, .dynamic-text-container, .dynamic-word-container"
      );
      
      console.log(`[LOAD-DYNAMIC] Found ${dynamicContainers.length} dynamic containers in passage ${passageElement.id}`);
      
      if (dynamicContainers.length === 0) {
        console.log(`[LOAD-DYNAMIC] No dynamic content to load for passage ${passageElement.id}`);
        return Promise.resolve();
      }

      // Mark this passage as being loaded
      passageElement._dynamicContentLoading = true;
      
      const promises = Array.from(dynamicContainers).map((container) => {
        let blockType = this.getDynamicContainerType(container);
        let blockId = container.dataset.uuid;
        
        console.log(`[LOAD-DYNAMIC] Will load ${blockType} with ID ${blockId}`);
        
        // Check if this container was already processed
        if (container._dynamicContentLoaded) {
          console.warn(`[LOAD-DYNAMIC] Container for block ${blockId} already loaded!`);
          return Promise.resolve();
        }
        
        // Mark as loaded to prevent duplicate loads
        container._dynamicContentLoaded = true;
        
        return this.fetchDynamicBlock(blockId, blockType, container);
      });

      // Store the promise for future reference
      passageElement._dynamicContentLoadingPromise = Promise.all(promises)
        .then(results => {
          console.log(`[LOAD-DYNAMIC] All dynamic content loaded for passage ${passageElement.id}`);
          return results;
        })
        .catch(err => {
          console.error(`[LOAD-DYNAMIC] Error loading dynamic content for passage ${passageElement.id}:`, err);
          throw err;
        });
      
      return passageElement._dynamicContentLoadingPromise;
    },

    getDynamicContainerType(container) {
      if (container.classList.contains("dynamic-options-container"))
        return "dynamic-option";
      if (container.classList.contains("dynamic-text-container"))
        return "dynamic-text";
      if (container.classList.contains("dynamic-word-container"))
        return "dynamic-word";
      return "";
    },

    fetchDynamicBlock(blockID, blockType, container) {
      console.log(`[FETCH] Starting fetchDynamicBlock for ${blockID} of type ${blockType}`);
      
      const blockData = this.state.projectBlocks.find(
        (b) => b.id === blockID
      );

      if (!blockData) {
        console.error(`[FETCH] No block data found for ID: ${blockID}`);
        container.innerText = "No block data found";
        return Promise.resolve();
      }

      const loadingIndicator = container
        .closest(".dynamic-container")
        .querySelector(".loading-indicator");
        
      console.log(`[FETCH] Preparing request for block ${blockID} with player ID: ${this.config.playerId}`);
      console.log(`[FETCH] Station ID: ${this.config.stationId}, Station Number: ${this.config.stationNumber}`);

      const payload = {
        message: blockData.prompt || "",
        playerID: this.config.playerId,
        blockId: blockID,
        blockUUID: blockID, // keeping for backward compatibility
        instruction: blockData.prompt || "",
        contextRefs: (blockData.context || []).filter((ctx) => ctx.value),
        blockType,
        optionCount: blockData.optionCount,
        sentenceCount: blockData.sentenceCount,
        lexiconCategory: blockData.lexiconCategory,
        storyId: this.config.stationNumber, // Use the numeric station ID as story ID
        _fetchTimestamp: new Date().getTime() // Add timestamp to identify unique requests
      };
      
      console.log(`[FETCH] Sending request for block ${blockID}`, payload);

      return fetch(`${this.config.serverUrl}/generate-dynamic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(`Server error: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          // Hide loading indicator
          if (loadingIndicator) loadingIndicator.style.display = "none";
          this.renderDynamicContent(container, data, blockType, blockID);

          // After rendering dynamic content, check if we should update continue button
          this.checkPassageChoicesStatus();
        })
        .catch((err) => {
          console.error("Error in fetchDynamicBlock:", err);
          container.innerText = `Error loading dynamic content: ${err.message}`;
          if (loadingIndicator) loadingIndicator.style.display = "none";
        });
    },

    renderDynamicContent(container, data, blockType, blockID) {
      const renderers = {
        "dynamic-option": (container, data, blockID) => {
          const options = Array.isArray(data) ? data : ["?", "?", "?"];
          container.innerHTML = "";

          options.forEach((opt, i) => {
            // Add divider before all options except the first one
            if (i > 0) {
              const dividerEl = document.createElement("div");
              dividerEl.className = "option-divider";
              dividerEl.textContent = "/";
              container.appendChild(dividerEl);
            }

            const optEl = document.createElement("div");
            optEl.className = "static-option";
            optEl.dataset.index = i;
            optEl.textContent = opt;

            optEl.addEventListener("click", () => {
              this.selectOption(optEl, blockID, "dynamic-option");
            });

            container.appendChild(optEl);
          });
        },

        "dynamic-text": (container, data) => {
          container.innerHTML = `<div class="dynamic-text-result">${
            data || ""
          }</div>`;
        },

        "dynamic-word": (container, data) => {
          container.innerHTML = `<span class="dynamic-word">${
            data || ""
          }</span>`;
        },
      };

      const renderer = renderers[blockType];
      if (renderer) {
        renderer(container, data, blockID);
      } else {
        container.innerHTML = `<div class="error">Unknown dynamic block type: ${blockType}</div>`;
      }
    },

    // ===== INTERACTION HANDLING =====
    selectOption(elem, blockID, type) {
      const container = elem.parentElement;
      const allOpts = container.querySelectorAll(".static-option");

      // Mark this selection as already processed
      if (elem.classList.contains("selected")) {
        return; // Already processed this selection
      }
      // Immediately disable ALL options (including the selected one)
      allOpts.forEach((opt) => {
        opt.style.pointerEvents = "none"; // This prevents clicking
        opt.style.cursor = "default"; // Visual indicator that it's not clickable
        opt.onclick = null; // Remove click handlers
      });
      // Update UI - first mark the selected element
      elem.classList.add("selected");

      // Then fade the other options and dividers
      allOpts.forEach((o) => {
        if (o !== elem) {
          o.classList.add("faded");
          o.onclick = null; // Disable further clicks

          // Listen for the end of the fade animation and remove the element
          o.addEventListener(
            "transitionend",
            function () {
              if (o.parentElement) {
                // Check if still in DOM
              }
            },
            { once: true }
          );
        }
      });

      // Find and fade all dividers
      const dividers = container.querySelectorAll(".option-divider");
      dividers.forEach((divider) => {
        divider.classList.add("faded");
      });

      // Extract data
      const chosenText = elem.textContent;
      const chosenIndex =
        type === "static"
          ? parseInt(elem.dataset.idx)
          : parseInt(elem.dataset.index);

      // Record choice on server
      this.recordChoice(
        blockID,
        type,
        chosenIndex,
        chosenText,
        Array.from(allOpts).map((x) => x.textContent)
      );

      // Immediately check if we should show the continue button
      // Mark the selection as completed right away in the DOM
      container.dataset.selectionComplete = "true";

      // Force an immediate check for Continue button visibility
      setTimeout(() => this.checkPassageChoicesStatus(), 0);
    },

    recordChoice(
      blockID,
      blockType,
      chosenIndex,
      chosenText,
      availableOptions
    ) {
      // Find the block data to get instruction and context blocks
      const blockData = this.state.projectBlocks.find(
        (b) => b.id === blockID
      );
      const instruction = blockData?.prompt || "";
      const contextBlocks = (blockData?.context || []).filter(
        (ctx) => ctx.value
      );

      // Log the player ID being used in the request
      console.log("Recording choice with player ID:", this.config.playerId);
      
      fetch(`${this.config.serverUrl}/record-choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerID: this.config.playerId,
          blockUUID: blockID,
          blockType,
          chosenIndex,
          chosenText,
          availableOptions,
          instruction,
          contextBlocks,
        }),
      }).catch((err) => {
        this.log("Error recording choice:", err);
      });
    },

    // ===== CONTINUE BUTTON MANAGEMENT =====
    setupContinueButton(passageEl) {
      const continueLink = passageEl.querySelector(".next-link");
      if (!continueLink) return;

      // Check if passage has any option elements
      const hasOptions = this.passageHasUnselectedOptions(passageEl);

      if (hasOptions) {
        // Has options - continue will be shown when all are selected
        // (handled by checkPassageChoicesStatus)
        continueLink.style.display = "none";
      } else {
        // No options to select, show continue after delay
        setTimeout(() => {
          continueLink.style.display = "inline-block";
        }, 5000);
      }
    },

    passageHasUnselectedOptions(passageEl) {
      // Check all option containers
      const optionContainers = passageEl.querySelectorAll(
        ".static-option-container, .dynamic-options-container"
      );

      for (const container of optionContainers) {
        // Skip containers where a selection has already been made
        if (container.dataset.selectionComplete === "true") {
          continue;
        }

        // If there are any options that haven't been selected
        const options = container.querySelectorAll(".static-option");
        if (
          options.length > 0 &&
          !container.querySelector(".static-option.selected")
        ) {
          return true;
        }
      }

      return false;
    },

    checkPassageChoicesStatus() {
      const passageEl = document.getElementById(
        `passage-${this.state.currentPassageIndex}`
      );
      if (!passageEl) return;

      const continueLink = passageEl.querySelector(".next-link");
      if (!continueLink) return;

      // Check if there are any unselected options left
      const anyUnselectedOptions =
        this.passageHasUnselectedOptions(passageEl);

      // If no unselected options, show the continue button
      if (!anyUnselectedOptions) {
        continueLink.style.display = "inline-block";
      }
    },

    // ===== NAVIGATION =====
    goToNextPassage(currIndex) {
      const currentEl = document.getElementById(`passage-${currIndex}`);
      const nextIndex = currIndex + 1;

      // Render next passage if it doesn't exist yet
      if (!document.getElementById(`passage-${nextIndex}`)) {
        this.renderPassage(nextIndex);
      }

      const nextEl = document.getElementById(`passage-${nextIndex}`);
      nextEl.style.display = "none";

      // Handle transition
      this.transitionToNextPassage(currentEl, nextEl, nextIndex);
    },

    transitionToNextPassage(currentEl, nextEl, nextIndex) {
      // Start fade-out animation on current passage
      if (currentEl) {
        currentEl.classList.add("fade-out");
      }

      // Load dynamic content and handle transition
      this.loadDynamicContentForPassage(nextEl).then(() => {
        // Scroll to top immediately
        window.scrollTo(0, 0);

        // Simple approach: After fade-out completes, hide current and show next
        setTimeout(() => {
          if (currentEl) {
            // Hide current passage
            currentEl.classList.remove("active");
            currentEl.style.display = "none";
            currentEl.classList.remove("fade-out");
          }

          // Show next passage with fade-in
          nextEl.style.display = "block";
          nextEl.classList.add("active", "fade-in");
          this.state.currentPassageIndex = nextIndex;

          // Set up the continue button
          this.setupContinueButton(nextEl);

          // Clean up animation classes after fade-in completes
          setTimeout(() => {
            nextEl.classList.remove("fade-in");
          }, 3000); // Match the CSS animation duration (3s)
        }, 1000); // Wait for fade-out to complete (adjust if needed)
      });
    }
  }));
});