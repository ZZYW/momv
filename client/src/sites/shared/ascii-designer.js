
document.addEventListener("DOMContentLoaded", function (event) {
    // Only setup ASCII Continue button on load
    setTimeout(() => {
        setupAsciiContinueButton();
    }, 500);

    // Setup ASCII Continue Button Observer
    const buttonObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                // const nextLinks = document.querySelectorAll('.next-link');
                // nextLinks.forEach(link => {
                //     if (getComputedStyle(link).display !== 'none' && !link.dataset.asciiStyled) {
                //         styleAsciiContinueButton(link);
                //     }
                // });
            }
            
            if (mutation.type === 'childList') {
                // mutation.addedNodes.forEach(node => {
                //     if (node.nodeType === 1 && node.classList && node.classList.contains('next-link')) {
                //         styleAsciiContinueButton(node);
                //     }
                // });
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
    
    // Create a MutationObserver to watch for new content to add Continue buttons
    const contentObserver = new MutationObserver((mutations) => {
        // Check if the mutations actually changed the content
        const contentChanged = mutations.some(mutation => {
            // Check for added or removed nodes (content changes)
            return mutation.type === 'childList' && 
                  (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
        });
        
        // Only update if content actually changed
        if (contentChanged) {
            setTimeout(() => {
                setupAsciiContinueButton();
            }, 200); // Small delay to ensure content has rendered
        }
    });
    
    if (passageContainer) {
        contentObserver.observe(passageContainer, {
            childList: true,
            subtree: true
        });
    }
    
    // Functions for ASCII Continue Button
    function setupAsciiContinueButton() {
        return;
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
