from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from fastapi.middleware.cors import CORSMiddleware
import os
from groq import Groq

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Location(BaseModel):
    latitude: float
    longitude: float

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    # Fallback for local dev if .env not loaded by docker yet, or just warn
    print("Warning: GROQ_API_KEY not found in environment variables.")

client = Groq(
    api_key=api_key,
)

def get_aqi_data(lat, lon):
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    return None

def get_weather_data(lat, lon):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    return None

@app.post("/analyze")
async def analyze_aqi(location: Location):
    aqi_data = get_aqi_data(location.latitude, location.longitude)
    weather_data = get_weather_data(location.latitude, location.longitude)
    
    if not aqi_data:
        raise HTTPException(status_code=500, detail="Failed to fetch AQI data")

    current_aqi = aqi_data.get('current', {})
    current_weather = weather_data.get('current', {}) if weather_data else {}
    
    aqi = current_aqi.get('us_aqi', 'N/A')
    pm25 = current_aqi.get('pm2_5', 'N/A')
    pm10 = current_aqi.get('pm10', 'N/A')
    temp = current_weather.get('temperature_2m', 'N/A')
    humidity = current_weather.get('relative_humidity_2m', 'N/A')
    wind = current_weather.get('wind_speed_10m', 'N/A')
    
    # Construct prompt for the AI
    prompt = f"""
    Analyze the following Environmental data for a location:
    US AQI: {aqi}
    PM2.5: {pm25}
    PM10: {pm10}
    Temperature: {temp}°C
    Humidity: {humidity}%
    Wind Speed: {wind} km/h
    
    Provide a list of 5-6 clear, actionable health tips based strictly on this specific data.
    Format your response as a simple list of sentences, one per line.
    
    CRITICAL INSTRUCTIONS:
    - You MUST explicitly reference the current AQI ({aqi}) or specific pollutants (e.g., PM2.5 at {pm25}) in at least one of your tips to show the advice is live.
    - Tailor the advice specifically to these conditions.
    
    CRITICAL FORMATTING RULES:
    - Do NOT use headers or categories (e.g., "Health Risk:", "Recommendations:").
    - Do NOT use bold text (e.g., **text**).
    - Do NOT use bullet symbols (-, *, •).
    - Do NOT use introductory or concluding text.
    - Just write the advice directly.

    Example Output:
    Wear a mask if you need to be outdoors.
    Keep windows closed to prevent outdoor air from entering.
    Sensitive groups should avoid outdoor exertion.
    Run an air purifier if available.
    """

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are an expert environmental health assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        analysis = completion.choices[0].message.content
        
    except Exception as e:
        analysis = f"AI Analysis unavailable: {str(e)}"

    return {
        "aqi_data": current_aqi,
        "weather_data": current_weather,
        "analysis": analysis
    }
