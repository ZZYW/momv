import asciiBox from 'ascii-box';

export const generateBox = (req, res) => {
  try {
    const { message, border, color, padding, minWidth, maxWidth } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const options = {};
    if (border) options.border = border;
    if (color) options.color = color;
    if (padding !== undefined) options.padding = padding;
    if (minWidth !== undefined) options.minWidth = minWidth;
    if (maxWidth !== undefined) options.maxWidth = maxWidth;
    
    const boxedText = asciiBox(message, options);
    res.json({ result: boxedText });
  } catch (error) {
    console.error('Error generating ASCII box:', error);
    res.status(500).json({ error: 'Failed to generate ASCII box' });
  }
};