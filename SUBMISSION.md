# WindBorne Systems - Application Submission Guide

## Project Complete! 🎈

Your WindBorne Balloon Weather Tracker is ready to deploy and submit.

## What Was Built

A React + Vite web application that:
- ✅ Fetches 24 hours of balloon constellation data from WindBorne API
- ✅ Robustly handles corrupted/missing data
- ✅ Integrates OpenMeteo weather API for atmospheric conditions
- ✅ Displays interactive map with balloon trajectories
- ✅ Shows weather data when clicking balloon markers
- ✅ Auto-updates every hour
- ✅ Follows clean UI design with single-card layout

## Next Steps

### 1. Deploy to Vercel (Recommended)

**Why Vercel?**
- Free hosting for personal projects
- Automatic HTTPS
- Easy GitHub integration
- Perfect for React/Vite apps

**Steps:**
1. Create a GitHub repository and push your code:
   ```bash
   git init
   git add .
   git commit -m "WindBorne Balloon Tracker - Junior Web Developer Application"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com)
3. Sign up with GitHub
4. Click "Add New Project"
5. Import your GitHub repository
6. Vercel will auto-detect settings:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
7. Click "Deploy"
8. Your site will be live at: `https://your-project-name.vercel.app`

### 2. Prepare Your Application Submission

Fill in the POST request body with your information:

```json
{
  "career_application": {
    "name": "YOUR_NAME",
    "email": "YOUR_EMAIL",
    "role": "Junior Web Developer",
    "notes": "YOUR_ONE_SENTENCE about collaboration + 'I chose OpenMeteo weather API because it provides free, comprehensive atmospheric data that perfectly complements WindBorne's mission of improving weather prediction. By correlating balloon positions with real-time weather conditions (temperature, wind, pressure), the application demonstrates how balloons navigate different atmospheric systems.'",
    "submission_url": "https://your-project-name.vercel.app",
    "portfolio_url": "YOUR_PORTFOLIO_PROJECT_URL",
    "resume_url": "YOUR_RESUME_URL"
  }
}
```

### 3. Submit Your Application

Use curl or Postman to make the POST request:

```bash
curl -X POST https://windbornesystems.com/career_applications.json \
  -H "Content-Type: application/json" \
  -d '{
    "career_application": {
      "name": "YOUR_NAME",
      "email": "YOUR_EMAIL",
      "role": "Junior Web Developer",
      "notes": "YOUR_COLLABORATION_SENTENCE + API_CHOICE_EXPLANATION",
      "submission_url": "https://your-project-name.vercel.app",
      "portfolio_url": "YOUR_PORTFOLIO_URL",
      "resume_url": "YOUR_RESUME_URL"
    }
  }'
```

**Important:** Verify you get a 200 status code!

## Project Highlights

### Technical Implementation
- **Robust Data Fetching**: Handles all 24 hours of balloon data with comprehensive error handling
- **Weather Integration**: Real-time atmospheric conditions at each balloon location
- **Interactive Visualization**: Leaflet-based map with trajectory lines and clickable markers
- **Dynamic Updates**: Hourly refresh to maintain current constellation state
- **CORS Solution**: Vite proxy for development, direct API calls in production

### Why OpenMeteo?
- Free, no API key required
- Comprehensive atmospheric data
- Aligns with WindBorne's weather prediction mission
- Shows understanding of atmospheric science
- Demonstrates ability to integrate multiple data sources

### Code Quality
- Clean component structure
- Modular service layer
- Proper error handling
- Responsive design
- ESLint compliant
- Well-documented

## Testing Checklist

Before submitting, verify:
- [ ] Application loads at your deployed URL
- [ ] Map displays with balloon markers
- [ ] Clicking balloons shows weather data
- [ ] Trajectory lines are visible
- [ ] Stats dashboard shows correct numbers
- [ ] Mobile responsive
- [ ] Console has no errors
- [ ] README is updated with your project

## Local Development

To continue development:
```bash
npm run dev
```

To build for production:
```bash
npm run build
npm run preview  # Test production build locally
```

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Ensure dependencies are installed
4. Review Vite/React documentation

## Good Luck! 🚀

You've built a solid application that demonstrates:
- Full-stack development skills
- API integration
- Data visualization
- Problem-solving ability
- Understanding of WindBorne's mission

Your submission shows you can build production-ready applications!
