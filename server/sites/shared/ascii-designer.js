
document.addEventListener("DOMContentLoaded", function (event) {
    updateBorders();
    addVerticalBorders();
    
    // Run again after a delay to catch any dynamic content loading
    setTimeout(() => {
        updateBorders();
        addVerticalBorders();
        setupAsciiContinueButton();
    }, 500);

    // Also update when window is resized
    window.addEventListener("resize", () => {
        updateBorders();
        addVerticalBorders();
        updateAsciiContinueButton();
    });
    
    // Setup ASCII Continue Button Observer
    const buttonObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const nextLinks = document.querySelectorAll('.next-link');
                nextLinks.forEach(link => {
                    if (getComputedStyle(link).display !== 'none' && !link.dataset.asciiStyled) {
                        styleAsciiContinueButton(link);
                    }
                });
            }
            
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('next-link')) {
                        styleAsciiContinueButton(node);
                    }
                });
            }
        });
    });
    
    // Observe the entire passage container for new Continue buttons
    const passageContainer = document.getElementById('passage-container');
    if (passageContainer) {
        buttonObserver.observe(passageContainer, { 
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });
    }

    function updateBorders() {
        const passageContainer = document.getElementById("passage-container");
        if (!passageContainer) return;

        const width = passageContainer.offsetWidth;
        const dashCount = Math.max(width / 8 + 3, 20); // Approximate character width

        const borderLine = "+" + "-".repeat(Math.floor(dashCount)) + "+";

        document.getElementById("ascii-top").textContent = borderLine;
    }

    function addVerticalBorders() {
        // Configuration constants for border design
        const CONFIG = {
            maxHeight: 280,           // Maximum height for the borders
            baseInterval: 12,         // Base distance between markers
            barCount: 3,              // Number of solid bars at the top
            growthRate: 0.1,          // How quickly spacing increases (higher = faster fade)
            paddingSize: 20,          // Padding added to container for borders
            transitionPoint: 3        // Number of dots before more aggressive spacing
        };

        // Remove any existing vertical borders
        const existingBorders = document.querySelectorAll(".vertical-border");
        existingBorders.forEach((border) => border.remove());

        const passageContainer = document.getElementById("passage-container");
        if (!passageContainer) return;

        // Set relative positioning on the container if not already set
        if (getComputedStyle(passageContainer).position === "static") {
            passageContainer.style.position = "relative";
        }

        // Add padding to the sides of the container to make room for borders
        passageContainer.style.paddingLeft = `${CONFIG.paddingSize}px`;
        passageContainer.style.paddingRight = `${CONFIG.paddingSize}px`;

        // Get the height of the passage container
        const height = passageContainer.offsetHeight;
        const maxHeight = Math.min(CONFIG.maxHeight, height);

        // Create border containers with shared styles
        const createBorderContainer = (side) => {
            const border = document.createElement("div");
            border.className = `vertical-border ${side}-border`;
            Object.assign(border.style, {
                position: "absolute",
                [side]: "0",
                top: "0",
                height: `${height}px`,
                pointerEvents: "none" // Make sure it doesn't interfere with clicks
            });
            return border;
        };

        const leftBorder = createBorderContainer("left");
        const rightBorder = createBorderContainer("right");

        // Generate positions for border markers
        const generateMarkerPositions = () => {
            const positions = [];

            // Add solid bars at the top
            for (let i = 0; i < CONFIG.barCount; i++) {
                positions.push({
                    y: i * CONFIG.baseInterval,
                    char: "|"
                });
            }

            // Calculate starting position after bars
            let posY = CONFIG.baseInterval * CONFIG.barCount;
            let dotIndex = 0;

            // Add dots with exponentially increasing spacing
            while (posY < maxHeight) {
                positions.push({ y: posY, char: "." });

                // Adjust growth rate for smoother transition
                const growthFactor = dotIndex < CONFIG.transitionPoint ?
                    CONFIG.growthRate * 0.7 : CONFIG.growthRate;

                // Calculate gap to next marker using exponential growth
                const gap = CONFIG.baseInterval * Math.exp(growthFactor * dotIndex);
                posY += gap;
                dotIndex++;

                // Safety check to avoid infinite loops
                if (dotIndex > 30) break;
            }

            return positions;
        };

        // Create and add marker elements
        const addMarkers = (positions) => {
            positions.forEach((pos) => {
                // Create marker elements for both sides
                [leftBorder, rightBorder].forEach(border => {
                    const marker = document.createElement("div");
                    marker.textContent = pos.char;
                    marker.style.position = "absolute";
                    marker.style.top = `${pos.y}px`;
                    border.appendChild(marker);
                });
            });
        };

        // Generate and add marker positions
        const positions = generateMarkerPositions();
        addMarkers(positions);

        // Add the borders to the passage container
        passageContainer.appendChild(leftBorder);
        passageContainer.appendChild(rightBorder);
    }

    // Create a MutationObserver to watch for changes in the passage container
    const observer = new MutationObserver(() => {
        updateBorders();
        setTimeout(() => {
            addVerticalBorders();
            setupAsciiContinueButton();
        }, 200); // Small delay to ensure content has rendered
    });
    observer.observe(document.getElementById("passage-container"), {
        childList: true,
        subtree: true,
        attributes: true,
    });
    
    // Functions for ASCII Continue Button
    function setupAsciiContinueButton() {
        const nextLinks = document.querySelectorAll('.next-link');
        nextLinks.forEach(link => {
            if (getComputedStyle(link).display !== 'none' && !link.dataset.asciiStyled) {
                styleAsciiContinueButton(link);
            }
        });
    }
    
    function styleAsciiContinueButton(button) {
        if (!button || button.dataset.asciiStyled) return;
        
        // Mark as styled to prevent duplicates
        button.dataset.asciiStyled = "true";
        
        // Remove any existing styles 
        button.removeAttribute('style');
        if (button.classList.contains('next-link')) {
            button.style.border = 'none';
            button.style.background = 'none';
        }
        
        // Get button width to determine border width
        const buttonText = button.textContent || "继续";
        const textLength = buttonText.length;
        const borderWidth = Math.max(textLength + 6, 10); // Add some padding
        
        // Create top and bottom borders
        const topBorder = document.createElement('div');
        topBorder.className = 'button-ascii-border top';
        topBorder.textContent = "+" + "-".repeat(borderWidth) + "+";
        
        const bottomBorder = document.createElement('div');
        bottomBorder.className = 'button-ascii-border bottom';
        bottomBorder.textContent = "+" + "-".repeat(borderWidth) + "+";
        
        // Create left and right borders with dots
        const leftSide = document.createElement('div');
        leftSide.className = 'button-ascii-border left';
        leftSide.textContent = "| ";
        
        const rightSide = document.createElement('div');
        rightSide.className = 'button-ascii-border right';
        rightSide.textContent = " |";
        
        // Create button wrapper for positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'ascii-button-wrapper';
        wrapper.style.display = 'inline-block';
        wrapper.style.textAlign = 'center';
        wrapper.style.fontFamily = 'monospace';
        wrapper.style.whiteSpace = 'nowrap';
        wrapper.style.position = 'relative';
        wrapper.style.cursor = 'pointer';
        
        // Position the borders
        topBorder.style.textAlign = 'center';
        bottomBorder.style.textAlign = 'center';
        
        // Create middle row with text
        const textRow = document.createElement('div');
        textRow.className = 'button-ascii-text';
        textRow.style.display = 'flex';
        textRow.style.justifyContent = 'space-between';
        textRow.style.alignItems = 'center';
        
        // Copy the original button content and style
        const textSpan = document.createElement('span');
        textSpan.textContent = buttonText;
        textSpan.style.padding = '0 10px';
        
        // No hover color change
        
        // Build the button structure
        textRow.appendChild(leftSide);
        textRow.appendChild(textSpan);
        textRow.appendChild(rightSide);
        
        wrapper.appendChild(topBorder);
        wrapper.appendChild(textRow);
        wrapper.appendChild(bottomBorder);
        
        // Replace button content with the styled version
        button.textContent = '';
        button.appendChild(wrapper);
        
        // Center in parent container
        const container = button.closest('.navigation-container');
        if (container) {
            container.style.textAlign = 'center';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.margin = '30px 0';
        }
    }
    
    function updateAsciiContinueButton() {
        // Remove ASCII styling and re-apply it
        const styledButtons = document.querySelectorAll('[data-ascii-styled="true"]');
        styledButtons.forEach(button => {
            button.dataset.asciiStyled = "false";
            button.innerHTML = button._originalText || "继续";
            styleAsciiContinueButton(button);
        });
    }
});
