# Weather Balloon Tracker

An interactive web application that visualizes global weather balloon constellation data combined with real-time atmospheric conditions.

## Project Overview

This application fetches live data from a global balloon tracking API and combines it with weather data from OpenMeteo to create an interactive visualization of balloon positions and atmospheric conditions over the past 24 hours.

## Features

- **Live Balloon Tracking**: Displays current positions of all active weather balloons
- **24-Hour History**: Shows flight paths and historical positions
- **Weather Integration**: Displays atmospheric conditions at each balloon location
- **Interactive Map**: Clickable markers with detailed information
- **Auto-Updates**: Refreshes data every hour to stay current
- **Robust Error Handling**: Gracefully handles corrupted or missing data

## Data Sources

### WindBorne Balloon API
- **Endpoint**: `https://a.windbornesystems.com/treasure/[00-23].json`
- **Data**: Balloon positions, altitude, and flight information
- **Update Frequency**: Hourly (00.json = current, 23.json = 23 hours ago)

### OpenMeteo Weather API
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Data**: Temperature, wind speed/direction, pressure, humidity
- **Update Frequency**: Hourly
- **API Key**: Not required (free, open-source)

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Leaflet.js** - Interactive mapping
- **React-Leaflet** - React bindings for Leaflet
- **OpenMeteo API** - Weather data (no API key needed)

## Installation & Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:5173/`

## How It Works

1. **Data Collection**: Fetches 24 JSON files from WindBorne API (00.json through 23.json)
2. **Data Processing**: Validates and extracts balloon positions, handles corrupted entries
3. **Weather Enrichment**: Queries OpenMeteo for atmospheric conditions at each balloon location
4. **Visualization**: Displays balloons on interactive map with weather data overlays
5. **Updates**: Auto-refreshes every hour to maintain current data

## Why Weather Data?

Weather balloons play a crucial role in atmospheric research and weather prediction. By combining balloon position data with actual weather conditions, this application:

- Demonstrates understanding of atmospheric science
- Shows practical application of meteorological data
- Provides insights into how balloons interact with weather systems
- Visualizes the correlation between balloon movement and atmospheric conditions

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy!

### Deploy to Netlify

1. Push your code to GitHub
2. Connect repository to Netlify
3. Configure build settings:
   - Build Command: `npm run build`
   - Publish Directory: `dist`
4. Deploy!

### Other Hosting Options
- GitHub Pages
- Cloudflare Pages
- Any static hosting service

## Project Structure

```
weather-balloon-tracker/
├── src/
│   ├── components/
│   │   └── BalloonMap.jsx      # Map component with balloon markers
│   ├── services/
│   │   └── dataFetcher.js      # API calls and data processing
│   ├── config.js               # Configuration and constants
│   ├── App.jsx                 # Main application component
│   ├── App.css                 # Application styles
│   └── main.jsx               # React entry point
├── public/                     # Static assets
├── index.html                  # HTML entry point
├── vite.config.js             # Vite configuration with proxy
├── package.json               # Dependencies
└── README.md                  # This file
```

## Development Notes

### CORS Handling
- Development uses Vite proxy to avoid CORS issues
- Production directly calls the WindBorne API
- Configuration handled automatically based on environment

### Error Handling
The application robustly handles:
- Missing JSON files
- Corrupted data entries
- Network failures
- Invalid coordinates
- API rate limits

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

- Historical data comparison
- Balloon trajectory predictions
- Weather pattern analysis
- Export data functionality
- Mobile app version
- Real-time notifications

## License

Open source project for educational and demonstration purposes.

## Contact

For questions about this project, please refer to the project repository or documentation.
