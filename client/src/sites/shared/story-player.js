document.addEventListener("alpine:init", () => {
  // Create a global flag for Alpine data initialization
  if (window._storyPlayerDataInitialized) {
    console.warn('[ALPINE] storyPlayer data already initialized! Skipping duplicate initialization');
    return;
  }
  window._storyPlayerDataInitialized = true;

  // Add SVG filters for wavy text effect
  const svgFilters = document.createElement('div');
  svgFilters.innerHTML = `
    <svg width="0" height="0" style="position:absolute;">
      <defs>
        <filter id="wavy" filterUnits="userSpaceOnUse" x="0" y="0">
          <feTurbulence id="wave-animation" numOctaves="1" seed="1" baseFrequency="0.01 0.03">
          </feTurbulence>
          <feDisplacementMap scale="5" in="SourceGraphic"></feDisplacementMap>
        </filter>
      </defs>
    </svg>
  `;
  document.body.appendChild(svgFilters);

  // Add the animation using JavaScript for better browser support
  setTimeout(() => {
    const turbulence = document.getElementById('wave-animation');
    if (turbulence) {
      let phase = 0;

      setInterval(() => {
        phase += 0.03;
        let y = Math.sin(phase) * 0.015 + 0.03;
        turbulence.setAttribute('baseFrequency', `0.01 ${y.toFixed(4)}`);
      }, 60);
    }
  }, 100);

  console.log('[ALPINE] Initializing storyPlayer data component');

  Alpine.data("storyPlayer", () => ({
    // ===== CONFIGURATION =====
    config: {
      // Use SERVER_CONFIG if already available from codename verification
      serverUrl: window.SERVER_CONFIG?.apiServerUrl ||
        (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin),
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
      stationNumber: window.location.pathname.includes("station2") ? "2" : "1",
      // Server configuration status - already loaded if window.SERVER_CONFIG exists
      serverConfigLoaded: !!window.SERVER_CONFIG,
      // Central backend flag if already available
      hasCentralBackend: window.SERVER_CONFIG?.hasCentralBackend || false
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
      console.log("Initializing story player...");

      // Check if server config is already loaded from codename verification
      if (this.config.serverConfigLoaded) {
        console.log("[INIT] Using pre-loaded server configuration");
        console.log("[INIT] API Server URL:", this.config.serverUrl);
        console.log("[INIT] Has Central Backend:", this.config.hasCentralBackend);

        // Proceed directly with story loading
        this.loadStory();
      } else {
        // Otherwise, fetch server configuration first
        console.log("[INIT] No pre-loaded server configuration, fetching from server...");
        this.fetchServerConfig().then(() => {
          // After server config is loaded, proceed with story loading
          this.loadStory();
        });
      }

      // Add window resize listener to adjust borders when the window is resized
      window.addEventListener('resize', () => {
        const currentPassage = document.getElementById(`passage-${this.state.currentPassageIndex}`);
        if (currentPassage && currentPassage.classList.contains('active')) {
          // Use setTimeout to ensure the passage has been rendered and has its final dimensions
          setTimeout(() => {
            // This will also call adjustHorizontalDivider
            this.adjustVerticalBordersHeight(currentPassage);
          }, 100);
        }
      });
    },

    // Fetch server configuration to determine API endpoints
    fetchServerConfig() {
      console.log("[CONFIG] Fetching server configuration...");

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
          console.log("[CONFIG] Server configuration received:", config);

          // Update the server URL if a central backend is specified
          if (config.apiServerUrl) {
            this.config.serverUrl = config.apiServerUrl;
            console.log(`[CONFIG] Using API server URL: ${this.config.serverUrl}`);
          }

          this.config.hasCentralBackend = config.hasCentralBackend;
          this.config.serverConfigLoaded = true;

          return config;
        })
        .catch(error => {
          console.error("[CONFIG] Error fetching server configuration:", error);
          console.log("[CONFIG] Falling back to default server URL:", this.config.serverUrl);

          // Still mark as loaded even if it failed, so we continue with defaults
          this.config.serverConfigLoaded = true;
        });
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
              // For Station 2, show loading animation while first passage loads
              if (this.config.stationId === "station2") {
                // Hide the passage initially
                firstPassage.style.display = "none";

                // Show loading animation
                this.showLoadingAnimation();

                // Then load the dynamic content
                this.loadDynamicContentForPassage(firstPassage).then(() => {
                  // Hide loading animation
                  this.hideLoadingAnimation();

                  // Process placeholders and adjust borders
                  this.processAllPlainBlockPlaceholders();
                  this.adjustVerticalBordersHeight(firstPassage);

                  // Now show the passage with fade-in effect
                  firstPassage.classList.add("active", "fade-in");
                  firstPassage.style.display = "block";

                  // Set up continue button
                  this.setupContinueButton(firstPassage);

                  // Remove animation class after completion
                  setTimeout(() => {
                    firstPassage.classList.remove("fade-in");
                  }, 3000);
                });
              } else {
                // Original behavior for Station 1 and other stations
                firstPassage.classList.add("active");
                this.loadDynamicContentForPassage(firstPassage).then(() => {
                  this.setupContinueButton(firstPassage);

                  // After everything is loaded, process any placeholders in plain blocks
                  this.processAllPlainBlockPlaceholders();

                  // Make sure to adjust border heights when initial passage is loaded
                  this.adjustVerticalBordersHeight(firstPassage);
                });
              }
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

    // Process all plain blocks in the current passage to replace placeholders
    processAllPlainBlockPlaceholders() {
      console.log("Processing all plain blocks for placeholders...");
      const plainBlocks = document.querySelectorAll('.plain');

      plainBlocks.forEach((block, index) => {
        console.log(`Processing plain block ${index}`);
        const originalContent = block.innerHTML;
        let processedContent = originalContent;
        let contentChanged = false;

        // Check for answer placeholders
        if (originalContent.includes('{get answer of question#')) {
          console.log(`Block ${index} contains answer placeholders, processing...`);

          // Use regex to find all question IDs in the content
          const regex = /\{get\s+answer\s+of\s+question#([a-zA-Z0-9\-]+)\s+from\s+this\s+player\}/gi;
          let match;

          // Reset regex lastIndex
          regex.lastIndex = 0;

          // Process each placeholder
          while ((match = regex.exec(originalContent)) !== null) {
            const fullMatch = match[0];
            const questionId = match[1];

            console.log(`Found placeholder for question ${questionId}`);

            // Get the answer
            const answer = this.getPlayerAnswerForQuestion(questionId);

            if (answer) {
              console.log(`Retrieved answer: "${answer}", replacing placeholder`);
              // Replace this specific instance
              processedContent = processedContent.replace(fullMatch, answer);
              contentChanged = true;
            } else {
              console.log(`No answer found for question ${questionId}`);
            }
          }
        }

        // Check for codename placeholders
        if (originalContent.includes('{get codename}')) {
          console.log(`Block ${index} contains codename placeholder, processing...`);

          // Use regex to find all codename placeholders
          const regex = /\{get\s+codename\}/gi;

          // Reset regex lastIndex
          regex.lastIndex = 0;

          // Get the codename
          const codename = this.getPlayerCodename();

          if (codename) {
            console.log(`Retrieved codename: "${codename}", replacing placeholder`);
            // Replace all instances
            processedContent = processedContent.replace(regex, codename);
            contentChanged = true;
          } else {
            console.log(`No codename found for player ${this.config.playerId}`);
          }
        }

        // Update the block content if changes were made
        if (contentChanged) {
          console.log(`Updating block ${index} with processed content`);
          block.innerHTML = processedContent;
        }
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
        plain: (b) => {
          // Check if text contains any placeholders that need processing
          const text = this.processPlainBlockPlaceholders(b.text || "");
          return `<div class="plain">${text}</div>`;
        },

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

        // New unified dynamic block type with generateOptions flag
        "dynamic": (b) => {
          if (b.generateOptions) {
            return `
              <div class="dynamic-container">
                <div class="loading-indicator">...<span class="loading"></span></div>
                <div class="dynamic-options-container" data-uuid="${b.id}"></div>
              </div>`;
          } else {
            return `
              <div class="dynamic-container">
                <div class="loading-indicator">...<span class="loading"></span></div>
                <div class="dynamic-text-container" data-uuid="${b.id}"></div>
              </div>`;
          }
        },


        "scene-header": (b) => {
          // Generate the scene header HTML
          let bannerArtHTML = '';

          if (b.useBannerArt && b.bannerArt) {
            // Process banner art to ensure each line is exactly 63 characters
            const lines = b.bannerArt.split('\n');
            const processedLines = lines.map(line => {
              // Truncate if longer than 63 characters
              if (line.length > 63) {
                return line.substring(0, 63);
              }
              // Pad with spaces if shorter than 63 characters
              else if (line.length < 63) {
                return line.padEnd(63, ' ');
              }
              return line;
            });

            const processedBannerArt = processedLines.join('\n');
            bannerArtHTML = `<pre class="banner-art">${processedBannerArt}</pre>`;
          }

          return `
            <div class="scene-header">
              ${bannerArtHTML}
              <div class="scene-title">${b.titleName || "Scene"}</div>
              <div class="scene-header-divider">----------</div>
            </div>
          `;
        },
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
        } else if (this.config.stationId === "station2") {
          // For Station 2, call drawFulu API and show button when complete
          const addNewJourneyButton = (isFuluGenerated = false) => {
            // Create a container for the new journey button
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "codename-container";
            buttonContainer.style.marginTop = "30px";
            buttonContainer.style.textAlign = "center";

            // Add "start a new journey" button
            const newJourneyButton = document.createElement("button");
            newJourneyButton.className = "new-journey-button";
            newJourneyButton.innerText = "开始新的旅程";

            // Initially disable the button if Fulu is not yet generated
            if (!isFuluGenerated) {
              newJourneyButton.disabled = true;
              newJourneyButton.style.opacity = "0.5";
              newJourneyButton.style.cursor = "not-allowed";
            }

            newJourneyButton.addEventListener("click", () => {
              window.location.reload();
            });

            buttonContainer.appendChild(newJourneyButton);

            // Add message about talisman if Fulu is generated
            if (isFuluGenerated) {
              const fuluMessage = document.createElement("div");
              fuluMessage.className = "fulu-message";
              fuluMessage.style.marginTop = "10px";
              fuluMessage.style.fontSize = "0.9em";
              fuluMessage.innerText = "--- 请转身领取您的符咒 ---";
              buttonContainer.appendChild(fuluMessage);
            }

            passageEl.appendChild(buttonContainer);

            return { buttonContainer, newJourneyButton };
          };

          // Function to generate Fulu
          const generateFulu = () => {
            console.log("Generating Fulu for player:", this.config.playerId);

            // Add loading message
            const loadingContainer = document.createElement("div");
            loadingContainer.className = "fulu-loading";
            loadingContainer.style.marginTop = "20px";
            loadingContainer.style.textAlign = "center";
            loadingContainer.innerHTML = "...";
            passageEl.appendChild(loadingContainer);

            // Call the API to generate Fulu
            fetch(`${this.config.serverUrl}/draw-fulu`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId: this.config.playerId })
            })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
              })
              .then(data => {
                console.log("Fulu generated successfully:", data);

                // Remove loading message
                loadingContainer.remove();

                // Only now add the button (fully enabled) after Fulu is generated
                const { buttonContainer } = addNewJourneyButton(true);
              })
              .catch(error => {
                console.error("Error generating Fulu:", error);

                // Remove loading message
                loadingContainer.remove();

                // Add button container for error message
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "codename-container";
                buttonContainer.style.marginTop = "30px";
                buttonContainer.style.textAlign = "center";

                // Show error message
                const errorMessage = document.createElement("div");
                errorMessage.className = "error-message";
                errorMessage.style.color = "red";
                errorMessage.style.marginTop = "10px";
                errorMessage.innerText = "----?";
                buttonContainer.appendChild(errorMessage);

                // Add button so user can continue anyway
                const newJourneyButton = document.createElement("button");
                newJourneyButton.className = "new-journey-button";
                newJourneyButton.innerText = "故事结束";
                newJourneyButton.addEventListener("click", () => {
                  window.location.reload();
                });
                buttonContainer.appendChild(newJourneyButton);

                passageEl.appendChild(buttonContainer);
              });
          };

          // Check if there are unselected options before generating Fulu
          if (this.passageHasUnselectedOptions(passageEl)) {
            const checkInterval = setInterval(() => {
              if (!this.passageHasUnselectedOptions(passageEl)) {
                clearInterval(checkInterval);
                generateFulu();
              }
            }, 500);
          } else {
            generateFulu();
          }
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
          promptMessage.innerHTML = "并赐予他一化名：";

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

              // Add a small message and countdown below the options
              setTimeout(() => {
                // Create a small reminder message
                const reminderMessage = document.createElement("div");
                reminderMessage.className = "codename-reminder";
                reminderMessage.innerHTML = `<p>请务必牢记您的化名……</p>`;


                // Create countdown container
                const countdownContainer = document.createElement("div");
                countdownContainer.className = "countdown-container";
                countdownContainer.style.marginTop = "15px";
                countdownContainer.style.textAlign = "center";

                // Set countdown duration
                const totalSeconds = 20;

                // Add countdown text
                const countdownText = document.createElement("div");
                countdownText.className = "countdown-text";
                countdownText.textContent = `下一位旅人的故事将在 ${totalSeconds} 秒内开始`;

                // Add ASCII progress bar
                const progressBar = document.createElement("div");
                progressBar.className = "countdown-bar";
                progressBar.style.fontFamily = "monospace";
                progressBar.style.letterSpacing = "2px";
                progressBar.textContent = "────────────────────────";

                // Add elements to container
                countdownContainer.appendChild(countdownText);
                countdownContainer.appendChild(progressBar);

                // Add elements to codename container
                codenameContainer.appendChild(reminderMessage);
                codenameContainer.appendChild(countdownContainer);

                // Start the countdown
                let secondsLeft = totalSeconds;
                const fullBar = progressBar.textContent;
                const barLength = fullBar.length;

                const countdownInterval = setInterval(() => {
                  secondsLeft -= 0.5;

                  // Update text with properly parameterized value
                  countdownText.textContent = `下一位旅人的故事将在 ${Math.ceil(secondsLeft)} 秒内开始`;

                  // Update progress bar
                  const remainingChars = Math.floor((secondsLeft / totalSeconds) * barLength);
                  progressBar.textContent = fullBar.substring(0, remainingChars);

                  // When countdown ends, refresh page
                  if (secondsLeft <= 0) {
                    clearInterval(countdownInterval);
                    window.location.reload();
                  }
                }, 500); // Update every half second
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
        // Even if there's no dynamic content, we should adjust vertical borders
        this.adjustVerticalBordersHeight(passageElement);
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
          // After all dynamic content is loaded, adjust vertical borders height
          this.adjustVerticalBordersHeight(passageElement);
          return results;
        })
        .catch(err => {
          console.error(`[LOAD-DYNAMIC] Error loading dynamic content for passage ${passageElement.id}:`, err);
          throw err;
        });

      return passageElement._dynamicContentLoadingPromise;
    },

    // Adjust the width of horizontal divider under scene header
    adjustHorizontalDivider(passageElement) {
      console.log(`[BORDERS] Adjusting horizontal divider for passage ${passageElement.id}`);

      // Find the scene header divider in this passage
      const divider = passageElement.querySelector('.scene-header-divider');
      if (!divider) {
        console.warn('[BORDERS] Could not find scene header divider');
        return;
      }

      // Calculate available width
      const containerWidth = divider.offsetWidth;
      console.log(`[BORDERS] Container width: ${containerWidth}px`);

      // Create divider content based on available width
      // Each dash-space unit takes approximately 2ch of width
      // We'll create a pattern of "- " repeated to fill the width
      const charWidth = 7; // Approximate width of monospace character in pixels
      const dashSpacePairWidth = charWidth; // Width of "- " in pixels
      const pairs = Math.floor(containerWidth / dashSpacePairWidth);

      console.log(`[BORDERS] Creating divider with ${pairs} dash-space pairs`);

      // Create the divider content
      let dividerContent = '';
      for (let i = 0; i < pairs; i++) {
        dividerContent += '-';
      }

      // Set the content for the divider
      divider.textContent = dividerContent;

      console.log('[BORDERS] Horizontal divider width adjusted');
    },

    // Adjust the height of vertical borders based on passage content height
    adjustVerticalBordersHeight(passageElement) {
      console.log(`[BORDERS] Adjusting vertical borders height for passage ${passageElement.id}`);

      // Get the passage height
      const passageHeight = passageElement.offsetHeight;
      console.log(`[BORDERS] Passage height: ${passageHeight}px`);

      // Get the vertical borders
      const leftBorder = document.querySelector('.static-vertical-border.left-border');
      const rightBorder = document.querySelector('.static-vertical-border.right-border');

      if (!leftBorder || !rightBorder) {
        console.warn('[BORDERS] Could not find vertical borders');
        return;
      }

      // Create border content based on passage height
      // Calculate how many line breaks we need - assuming 1.5 line height
      // and each character is roughly 18px in height (12px font * 1.5 line-height)
      const lineHeight = 18; // This is an approximation
      const linesNeeded = Math.ceil(passageHeight / lineHeight);

      console.log(`[BORDERS] Creating border with ${linesNeeded} lines`);

      // Create the border content
      let borderContent = '|<br>|<br>|<br>'; // Start with 3 solid lines

      // Add dotted lines for the remaining height
      for (let i = 0; i < linesNeeded - 3; i++) {
        borderContent += '.<br>';
      }

      // Set the content for both borders
      leftBorder.innerHTML = borderContent;
      rightBorder.innerHTML = borderContent;

      // Also adjust the horizontal divider
      this.adjustHorizontalDivider(passageElement);

      console.log('[BORDERS] Vertical borders height adjusted');
    },

    getDynamicContainerType(container) {
      // For unified dynamic type, use the container class to determine rendering approach
      if (container.classList.contains("dynamic-options-container")) {
        // If the container is for options, return the unified 'dynamic' type
        // The renderDynamicContent function will handle rendering based on container class
        return "dynamic";
      }
      if (container.classList.contains("dynamic-text-container"))
        return "dynamic"; // Unified type for text content
      if (container.classList.contains("dynamic-word-container"))
        return "dynamic"; // Unified type for word content

      // If no specific container class is found, return empty string
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

      // Determine the blockType to send to the server
      let serverBlockType = 'dynamic'; // Always use the unified 'dynamic' block type for server
      let generateOptions = false;

      // Handle block types to determine generateOptions flag
      if (blockData.type === 'dynamic') {
        // For unified dynamic block, use its generateOptions property
        generateOptions = !!blockData.generateOptions;
      } else if (blockData.type === 'dynamic-option') {
        // For legacy dynamic-option, set generateOptions to true
        generateOptions = true;
      }

      // Keep the original blockType for rendering
      // This allows the renderDynamicContent function to properly handle both 
      // unified and legacy block types

      const payload = {
        message: blockData.prompt || "",
        playerID: this.config.playerId,
        blockId: blockID,
        blockUUID: blockID, // keeping for backward compatibility
        instruction: blockData.prompt || "",
        contextRefs: (blockData.context || []).filter((ctx) => ctx.value),
        blockType: serverBlockType,
        generateOptions: generateOptions,
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
      // Render function for option-generating blocks
      const renderOptions = (container, data, blockID) => {
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
            this.selectOption(optEl, blockID, "dynamic");
          });

          container.appendChild(optEl);
        });
      };

      // Render function for text-generating blocks
      const renderText = (container, data) => {
        // Handle different data formats: string, object, or array
        let contentToDisplay = '';

        if (typeof data === 'string') {
          // String data can be displayed directly
          contentToDisplay = data;
        } else if (typeof data === 'object' && data !== null) {
          // For objects, check if they have a deliverable property (AI response structure)
          if (data.deliverable) {
            if (typeof data.deliverable === 'string') {
              contentToDisplay = data.deliverable;
            } else if (typeof data.deliverable === 'object' && data.deliverable !== null) {
              // If deliverable is an object, format each key-value pair
              contentToDisplay = Object.entries(data.deliverable)
                .map(([key, value]) => `<div class="dynamic-section"><h3>${key}</h3><p>${value}</p></div>`)
                .join('');
            }
          } else {
            // Fallback: convert object to formatted JSON string
            contentToDisplay = JSON.stringify(data, null, 2).replace(/\n/g, '<br>').replace(/\s\s/g, '&nbsp;&nbsp;');
          }
        }

        container.innerHTML = `<div class="dynamic-text-result">${contentToDisplay || ""}</div>`;
      };

      // Unified renderer system that handles both legacy and new types
      const renderers = {
        // Unified dynamic block renderer based on block type
        "dynamic": (container, data, blockID) => {
          // Check if this container is for options or text based on class
          if (container.classList.contains("dynamic-options-container")) {
            renderOptions(container, data, blockID);
          } else {
            renderText(container, data);
          }
        },

        // Legacy handlers for backward compatibility (use the same rendering functions)
        "dynamic-option": (container, data, blockID) => {
          renderOptions(container, data, blockID);
        },
        "dynamic-text": (container, data) => {
          renderText(container, data);
        },
        "dynamic-word": (container, data) => {
          container.innerHTML = `<span class="dynamic-word">${data || ""}</span>`;
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
          : parseInt(elem.dataset.index); // Works for both 'dynamic' and legacy types

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

      // Store the selection in localStorage for synchronous access in plain blocks
      try {
        const selections = JSON.parse(localStorage.getItem(`selections_${this.config.playerId}`) || '{}');
        selections[blockID] = {
          chosenIndex,
          chosenText,
          availableOptions
        };
        localStorage.setItem(`selections_${this.config.playerId}`, JSON.stringify(selections));

        // Also store in memory on the block itself
        if (blockData) {
          blockData._selectedOption = {
            index: chosenIndex,
            text: chosenText
          };
        }
      } catch (err) {
        console.error('Error saving selection to localStorage:', err);
      }

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

      // Update any plain blocks that might be using this answer
      this.updatePlainBlocksWithAnswer(blockID, chosenText);
    },

    // Update any plain blocks that might be using the answer
    updatePlainBlocksWithAnswer(questionId, answer) {
      console.log(`Updating plain blocks with answer for question ${questionId}: "${answer}"`);

      // Find all plain blocks currently displayed
      const plainBlocks = document.querySelectorAll('.plain');
      console.log(`Found ${plainBlocks.length} plain blocks to check`);

      // Check each plain block for placeholders using this question ID
      plainBlocks.forEach((block, index) => {
        console.log(`Checking plain block ${index} content:`, block.innerHTML);

        // Use a more flexible pattern to match placeholders
        const pattern = new RegExp(`\\{get\\s+answer\\s+of\\s+question#${questionId}\\s+from\\s+this\\s+player\\}`, 'gi');

        // If the block contains a placeholder for this question
        if (pattern.test(block.innerHTML)) {
          console.log(`Found placeholder in block ${index}, replacing with "${answer}"`);

          // Replace the placeholder with the answer
          block.innerHTML = block.innerHTML.replace(pattern, answer);
          console.log(`Block updated. New content:`, block.innerHTML);
        } else {
          console.log(`No placeholder found in block ${index}`);
        }
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

    // Create and show the loading animation
    showLoadingAnimation() {
      // Create loading container if it doesn't exist
      let loadingContainer = document.getElementById('llm-loading-container');
      if (!loadingContainer) {
        loadingContainer = document.createElement('div');
        loadingContainer.id = 'llm-loading-container';
        loadingContainer.className = 'llm-loading-container';

        // Create a simple loading bar
        const loadingBar = document.createElement('div');
        loadingBar.className = 'llm-loading-bar';
        loadingBar.innerHTML = `<div class="llm-loading-animation">[.............?]</div>`;

        // Add to container
        loadingContainer.appendChild(loadingBar);

        // Add to body
        document.getElementById("passage-container").appendChild(loadingContainer);
      }

      // Display the loading animation
      loadingContainer.style.display = 'flex';

      // Start the animation
      this.startLoadingAnimation();

      return loadingContainer;
    },

    // Hide the loading animation
    hideLoadingAnimation() {
      const loadingContainer = document.getElementById('llm-loading-container');
      if (loadingContainer) {
        // Stop the animation
        this.stopLoadingAnimation();

        // Hide with fade out
        loadingContainer.classList.add('fade-out');

        // Remove after animation completes
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          loadingContainer.classList.remove('fade-out');
        }, 1000);
      }
    },

    // Animate the ASCII loading bar
    startLoadingAnimation() {
      if (this._loadingAnimationInterval) {
        clearInterval(this._loadingAnimationInterval);
      }

      const animationElement = document.querySelector('.llm-loading-animation');
      if (!animationElement) return;

      const frames = [
        // Frame 1: Arrow ↑ near the top
        `         
           ↑    
                
                
                
                
                
                
                
                `,
        
        // Frame 2: Arrow ↗ further down/right
        `          
                
             ↗  
                
                
                
                
                
                
                `,
      
        // Frame 3: Arrow → on the right side
        `          
                
                
                
              → 
                
                
                
                
                `,
      
        // Frame 4: Arrow ↘ closer to bottom-right
        `          
                
                
                
                
                
             ↘  
                
                
                `,
      
        // Frame 5: Arrow ↓ near the bottom
        `          
                
                
                
                
                
                
                
           ↓    
                `,
      
        // Frame 6: Arrow ↙ toward bottom-left
        `          
                
                
                
                
                
         ↙      
                
                
                `,
      
        // Frame 7: Arrow ← on the left side
        `          
                
                
                
        ←       
                
                
                
                
                `,
      
        // Frame 8: Arrow ↖ back toward top-left
        `          
                
         ↖      
                
                
                
                
                
                
                `,
      ];

      let frameIndex = 0;

      this._loadingAnimationInterval = setInterval(() => {
        // Update with the next frame
        animationElement.textContent = frames[frameIndex];

        // Move to the next frame
        frameIndex = (frameIndex + 1) % frames.length;
      }, 150);
    },

    // Stop the loading animation
    stopLoadingAnimation() {
      if (this._loadingAnimationInterval) {
        clearInterval(this._loadingAnimationInterval);
        this._loadingAnimationInterval = null;
      }
    },

    transitionToNextPassage(currentEl, nextEl, nextIndex) {
      // Start fade-out animation on current passage and ASCII borders
      if (currentEl) {
        currentEl.classList.add("fade-out");
        // Also add fade-out to the ASCII borders
        document.querySelector('.ascii-border.top').classList.add("fade-out");
        document.querySelectorAll('.static-vertical-border').forEach(border => {
          border.classList.add("fade-out");
        });
      }

      // After fade-out completes, hide current passage and show loading
      setTimeout(() => {
        if (currentEl) {
          // Hide current passage
          currentEl.classList.remove("active");
          currentEl.style.display = "none";
          currentEl.classList.remove("fade-out");
        }

        // Remove fade-out from borders
        document.querySelector('.ascii-border.top').classList.remove("fade-out");
        document.querySelectorAll('.static-vertical-border').forEach(border => {
          border.classList.remove("fade-out");
        });

        // Show loading animation while waiting for content
        this.showLoadingAnimation();

        // Load dynamic content - this is the API call to the LLM
        this.loadDynamicContentForPassage(nextEl).then(() => {
          // Hide loading animation
          this.hideLoadingAnimation();

          // Scroll to top before showing new content
          window.scrollTo(0, 0);

          // Show next passage with fade-in
          nextEl.style.display = "block";
          nextEl.classList.add("active", "fade-in");

          // Adjust vertical borders height for this passage after it's visible
          this.adjustVerticalBordersHeight(nextEl);

          // Also add fade-in to the ASCII borders
          document.querySelector('.ascii-border.top').classList.add("fade-in");
          document.querySelectorAll('.static-vertical-border').forEach(border => {
            border.classList.add("fade-in");
          });

          this.state.currentPassageIndex = nextIndex;

          // Set up the continue button
          this.setupContinueButton(nextEl);

          // Clean up animation classes after fade-in completes
          setTimeout(() => {
            nextEl.classList.remove("fade-in");
            // Remove fade-in from borders too
            document.querySelector('.ascii-border.top').classList.remove("fade-in");
            document.querySelectorAll('.static-vertical-border').forEach(border => {
              border.classList.remove("fade-in");
            });
          }, 3000); // Match the CSS animation duration (3s)
        });
      }, 1000); // Wait for fade-out to complete
    },

    // Process placeholders in plain blocks without sending to server
    processPlainBlockPlaceholders(text) {
      if (!text || typeof text !== 'string') {
        return text; // Return original text if not a string
      }

      console.log("Processing plain block text:", text);

      // Check if the text contains any placeholders
      if (!text.includes('{get')) {
        console.log("No placeholders found");
        return text;
      }

      let processedText = text;

      // 1. Look for {get answer of question#xxx from this player} pattern
      const answer_regex = /\{get\s+answer\s+of\s+question#([a-zA-Z0-9\-]+)\s+from\s+this\s+player\}/gi;

      console.log("Looking for answer placeholders with regex:", answer_regex.toString());

      // Replace each answer placeholder with the actual answer
      processedText = processedText.replace(answer_regex, (match, questionId) => {
        console.log(`Found answer placeholder: ${match}, extracting question ID: ${questionId}`);
        // Try to get the answer from localStorage or other client-side storage
        const answer = this.getPlayerAnswerForQuestion(questionId);
        console.log(`Answer for ${questionId}: "${answer}"`);
        return answer || match; // Return answer if found, otherwise keep original placeholder
      });

      // 2. Look for {get codename} pattern
      const codename_regex = /\{get\s+codename\}/gi;

      console.log("Looking for codename placeholders with regex:", codename_regex.toString());

      // Replace each codename placeholder with the player's codename
      processedText = processedText.replace(codename_regex, (match) => {
        console.log(`Found codename placeholder: ${match}`);
        // Try to get the codename from localStorage or other client-side storage
        const codename = this.getPlayerCodename();
        console.log(`Codename: "${codename}"`);
        return codename || match; // Return codename if found, otherwise keep original placeholder
      });

      console.log("Processed text:", processedText);
      return processedText;
    },

    // Get player's answer for a specific question from client-side storage
    getPlayerAnswerForQuestion(questionId) {
      console.log(`Trying to get answer for question ID: ${questionId}`);

      // First check localStorage
      try {
        const selections = localStorage.getItem(`selections_${this.config.playerId}`) || '{}';
        const parsedSelections = JSON.parse(selections);
        if (parsedSelections[questionId]) {
          console.log(`Found answer in localStorage: ${parsedSelections[questionId].chosenText}`);
          return parsedSelections[questionId].chosenText || '';
        }
      } catch (err) {
        console.error('Error parsing selections from localStorage:', err);
      }

      // Next, check if the block exists and check for playerChoice in block data
      const blockData = this.state.projectBlocks.find(b => b.id === questionId);
      if (blockData) {
        console.log(`Found block with ID ${questionId}`, blockData);

        // Check if it has playerChoice from server data
        if (blockData.playerChoice && blockData.playerChoice.chosenText) {
          console.log(`Found playerChoice in block data: ${blockData.playerChoice.chosenText}`);
          return blockData.playerChoice.chosenText;
        }

        // Check for _selectedOption from client-side selection
        if (blockData._selectedOption && blockData._selectedOption.text) {
          console.log(`Found _selectedOption in block data: ${blockData._selectedOption.text}`);
          return blockData._selectedOption.text;
        }
      }

      // Get directly from server
      console.log(`Fetching answer for question ${questionId} from server`);
      this.fetchPlayerAnswerFromServer(questionId);

      // Return empty for now, will be updated on the next render
      return '';
    },

    // Fetch player's answer from server if not available client-side
    fetchPlayerAnswerFromServer(questionId) {
      const url = `${this.config.serverUrl}/get-player-answer?playerId=${this.config.playerId}&questionId=${questionId}`;
      console.log(`Fetching player answer from: ${url}`);

      fetch(url)
        .then(response => {
          if (!response.ok) {
            console.error(`Server returned error: ${response.status}`);
            throw new Error('Failed to fetch answer');
          }
          return response.json();
        })
        .then(data => {
          console.log(`Server response for question ${questionId}:`, data);

          if (data && data.answer) {
            // Save the answer to localStorage for future use
            try {
              const selections = JSON.parse(localStorage.getItem(`selections_${this.config.playerId}`) || '{}');
              selections[questionId] = { chosenText: data.answer };
              localStorage.setItem(`selections_${this.config.playerId}`, JSON.stringify(selections));
              console.log(`Saved answer to localStorage: ${data.answer}`);

              // Update UI for all matching plain blocks
              const plainBlocks = document.querySelectorAll('.plain');
              console.log(`Found ${plainBlocks.length} plain blocks to check for updates`);

              plainBlocks.forEach((block, index) => {
                console.log(`Checking plain block ${index} content:`, block.innerHTML);

                // Use a more flexible pattern for replacement to match the original pattern 
                // that might have different spacing and casing
                const pattern = new RegExp(`\\{get\\s+answer\\s+of\\s+question#${questionId}\\s+from\\s+this\\s+player\\}`, 'gi');

                if (pattern.test(block.innerHTML)) {
                  console.log(`Block ${index} contains placeholder for question ${questionId}, replacing with "${data.answer}"`);
                  block.innerHTML = block.innerHTML.replace(pattern, data.answer);
                }
              });
            } catch (err) {
              console.error('Error updating localStorage with fetched answer:', err);
            }
          }
        })
        .catch(err => {
          console.error('Error fetching player answer:', err);
        });
    },

    // Get player's codename from client-side storage or server
    getPlayerCodename() {
      console.log(`Trying to get codename for player: ${this.config.playerId}`);

      // First check localStorage
      try {
        const codenameData = localStorage.getItem(`codename_${this.config.playerId}`);
        if (codenameData) {
          console.log(`Found codename in localStorage: ${codenameData}`);
          return codenameData;
        }
      } catch (err) {
        console.error('Error retrieving codename from localStorage:', err);
      }

      // Fetch from server if not in localStorage
      this.fetchPlayerCodenameFromServer();

      // Return empty for now, will be updated on the next render
      return '';
    },

    // Fetch player's codename from server
    fetchPlayerCodenameFromServer() {
      const url = `${this.config.serverUrl}/get-player-codename?playerId=${this.config.playerId}`;
      console.log(`Fetching player codename from: ${url}`);

      fetch(url)
        .then(response => {
          if (!response.ok) {
            console.error(`Server returned error: ${response.status}`);
            throw new Error('Failed to fetch codename');
          }
          return response.json();
        })
        .then(data => {
          console.log(`Server response for codename:`, data);

          if (data && data.codename) {
            // Save the codename to localStorage for future use
            try {
              localStorage.setItem(`codename_${this.config.playerId}`, data.codename);
              console.log(`Saved codename to localStorage: ${data.codename}`);

              // Update UI for all matching plain blocks
              const plainBlocks = document.querySelectorAll('.plain');
              console.log(`Found ${plainBlocks.length} plain blocks to check for updates`);

              plainBlocks.forEach((block, index) => {
                console.log(`Checking plain block ${index} content:`, block.innerHTML);

                // Use a flexible pattern for codename placeholder
                const pattern = /\{get\s+codename\}/gi;

                if (pattern.test(block.innerHTML)) {
                  console.log(`Block ${index} contains codename placeholder, replacing with "${data.codename}"`);
                  block.innerHTML = block.innerHTML.replace(pattern, data.codename);
                }
              });
            } catch (err) {
              console.error('Error updating localStorage with fetched codename:', err);
            }
          }
        })
        .catch(err => {
          console.error('Error fetching player codename:', err);
        });
    }
  }));
});