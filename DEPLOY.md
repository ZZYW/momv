# Deploying to Render.com

This guide explains how to deploy the Mountain of Many Voices stations for curator testing.

## Prerequisites

1. A [Render.com](https://render.com) account
2. Your DashScope API key for LLM integration

## Deployment Steps

### 1. Create a new Web Service on Render

1. Log in to your Render.com account
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository or use the "Public Git repository" option
4. Enter your repository details:
   - Name: `mountain-of-many-voices` (or your preferred name)
   - Root Directory: (leave blank)
   - Environment: `Node`
   - Branch: `main` (or your deployment branch)
   - Build Command: `npm install`
   - Start Command: `npm start`

### 2. Configure Environment Variables

Add the following environment variable in the Render dashboard:

- `DASHSCOPE_API_KEY`: Your DashScope API key

### 3. Deploy

1. Click "Create Web Service"
2. Wait for the deployment to complete (this might take a few minutes)

### 4. Access Your Stations

Once deployment is complete, you can access your stations at:

- Station 1: `https://your-app-name.onrender.com/station1`
- Station 2: `https://your-app-name.onrender.com/station2`

Share these URLs with your curator team.

## Updating Your Deployment

When you push changes to your configured branch, Render will automatically redeploy your application if you have enabled auto-deploy.

## Troubleshooting

If you encounter any issues:

1. Check the Render logs in the dashboard
2. Ensure your DashScope API key is correct
3. Verify that the application works locally before deploying